const {spawn} = require('node:child_process');
const WebSocket = require('ws');

// https://docs.claude.com/en/docs/claude-code/sdk/sdk-headless

console.log('Starting Claude WebSocket server on port 8080...');

// Connection counter for logging purposes
let connectionCounter = 0;

const wss = new WebSocket.Server({port: 8080});

wss.on('connection', (ws, req) => {
  // Generate unique connection ID for logging
  const connectionId = ++connectionCounter;
  console.log(`Claude WebSocket client connected (connection-${connectionId})`);

  // Check if claude command exists first
  const command = 'claude';
  const args = [
    '-p', // Use -p flag for multi-turn conversations
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];

  console.log(`Attempting to spawn: ${command} ${args.join(' ')}`);

  // Spawn agent process per connection (1:1 relationship)
  // Using stream-json input format to potentially avoid Node.js spawn hanging issue
  const agent = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'], // Back to pipe for stdin to allow message forwarding
    env: {
      ...process.env, // Inherit all environment variables including ANTHROPIC_API_KEY
      ANTHROPIC_API_KEY: '',
    },
  });

  console.log(`Claude agent process spawned with PID: ${agent.pid}`);

  agent.on('spawn', () => {
    console.log('Claude agent process successfully spawned');
  });

  agent.on('error', error => {
    console.error('Failed to start claude process:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path,
      spawnargs: error.spawnargs,
    });
    ws.close();
  });

  // Forward messages from WebSocket to agent stdin
  ws.on('message', message => {
    const messageText = message.toString();
    console.log('Message from WebSocket:', messageText);

    try {
      // Parse incoming message - if not JSON, treat as plain text
      let content;
      try {
        const parsed = JSON.parse(messageText);
        content = parsed.message || parsed.content || messageText;
      } catch {
        content = messageText;
      }

      // Using stream-json format - wrap message in correct schema
      const jsonMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [{type: 'text', text: content}],
        },
      };

      agent.stdin.write(JSON.stringify(jsonMessage) + '\n');
    } catch (error) {
      console.error('Error writing to agent stdin:', error);
    }
  });

  // Forward agent stdout back to WebSocket
  agent.stdout.on('data', data => {
    const output = data.toString();
    console.log('Agent stdout:', output);

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(output);
      }
    } catch (error) {
      console.error('Error sending data to WebSocket:', error);
    }
  });

  agent.stderr.on('data', data => {
    console.error('Claude agent stderr:', data.toString());
  });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log(`Claude WebSocket client disconnected (connection-${connectionId})`);

    if (agent && !agent.killed) {
      agent.kill('SIGTERM');
    }
  });

  agent.on('close', (code, signal) => {
    console.log(`Claude agent process exited with code ${code}, signal: ${signal}`);
    if (code === 143) {
      console.log(
        'Agent was terminated by SIGTERM (exit code 143) - this may be due to shell detection issues'
      );
    } else if (code !== 0) {
      console.error(`Agent exited unexpectedly with code: ${code}`);
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
});

wss.on('listening', () => {
  console.log('Claude WebSocket server listening on port 8080');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Claude WebSocket server...');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Shutting down Claude WebSocket server...');
  wss.close(() => {
    process.exit(0);
  });
});
