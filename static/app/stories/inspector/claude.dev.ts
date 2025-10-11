/* eslint-disable import/no-nodejs-modules */

import {spawn} from 'node:child_process';

import WebSocket from 'ws';

// https://docs.claude.com/en/docs/claude-code/sdk/sdk-headless

console.log('Starting Claude WebSocket server on port 8080...');

// Connection counter for logging purposes
let connectionCounter = 0;

const wss = new WebSocket.Server({port: 8080});

wss.on('connection', (ws, req) => {
  // Generate unique connection ID for logging
  const connectionId = ++connectionCounter;
  console.log(`Claude WebSocket client connected (connection-${connectionId})`);

  // Variable to store the Claude session UUID
  let claudeSessionId = null;

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
      ...process.env,
      ANTHROPIC_API_KEY: '',
    },
  });

  console.log(`Claude agent process spawned with PID: ${agent.pid}`);

  agent.on('spawn', () => {
    console.log('[Server] Claude agent process successfully spawned');
    console.log('[Server] Waiting for stdout data from Claude CLI...');
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

  // Buffer to accumulate partial JSON objects
  let buffer = '';
  let hasReceivedData = false;

  // Forward agent stdout back to WebSocket
  agent.stdout.on('data', data => {
    if (!hasReceivedData) {
      console.log('[Server] ✓ First data received from Claude CLI stdout!');
      hasReceivedData = true;
    }

    const output = data.toString();
    buffer += output;

    console.log('[Server] Received data chunk, buffer length:', buffer.length);
    console.log('[Server] Current claudeSessionId:', claudeSessionId || 'null');

    // Try to parse complete JSON objects from the buffer
    const lines = buffer.split('\n');

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    console.log(`[Server] Processing ${lines.length} complete lines`);

    for (const line of lines) {
      if (!line.trim()) continue;

      console.log(
        '[Server] Processing line:',
        line.substring(0, 200) + (line.length > 200 ? '...' : '')
      );

      // Try to extract session_id if we don't have it yet
      if (!claudeSessionId) {
        try {
          const parsed = JSON.parse(line);
          console.log('[Server] ========== FULL JSON MESSAGE ==========');
          console.log(JSON.stringify(parsed, null, 2));
          console.log('[Server] ============================================');
          console.log('[Server] Parsed object keys:', Object.keys(parsed));
          console.log('[Server] Checking for session_id field...');
          console.log('[Server] parsed.session_id value:', parsed.session_id);

          if (parsed.session_id) {
            claudeSessionId = parsed.session_id;
            console.log(`[Server] ✓✓✓ Captured Claude session ID: ${claudeSessionId}`);

            // Send the session ID to the client immediately
            if (ws.readyState === WebSocket.OPEN) {
              const sessionInfoMessage = JSON.stringify({
                type: 'session_info',
                session_id: claudeSessionId,
              });
              console.log(
                '[Server] Sending session_info message to client:',
                sessionInfoMessage
              );
              ws.send(sessionInfoMessage);
            } else {
              console.error('[Server] WebSocket not open, cannot send session_info');
            }
          } else {
            console.log('[Server] ❌ JSON parsed but no session_id field found');
          }
        } catch (parseError) {
          console.log('[Server] Line is not valid JSON:', parseError.message);
        }
      }

      // Forward the complete line to the client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(line);
      }
    }
  });

  agent.stderr.on('data', data => {
    const stderrOutput = data.toString();
    console.error('[Server] Claude agent stderr:', stderrOutput);

    // Some CLIs output session info to stderr, check there too
    if (!claudeSessionId && stderrOutput.includes('session')) {
      console.log('[Server] Found "session" in stderr, checking for session_id...');
      try {
        const lines = stderrOutput.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.session_id) {
                claudeSessionId = parsed.session_id;
                console.log(
                  `[Server] ✓✓✓ Captured session ID from stderr: ${claudeSessionId}`
                );
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'session_info',
                      session_id: claudeSessionId,
                    })
                  );
                }
              }
            } catch {
              // Not JSON
            }
          }
        }
      } catch (error) {
        console.error('[Server] Error parsing stderr:', error);
      }
    }
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
