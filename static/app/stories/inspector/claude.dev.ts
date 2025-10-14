/* eslint-disable import/no-nodejs-modules */
import {ChildProcess, spawn} from 'node:child_process';

import * as WebSocket from 'ws';

// The Orchestrator manages agent processes and relays messages between clients and agents.
// - On 'initialize': If the sessionId is unused, spawn an agent and associate it. Otherwise, do nothing.
// - On 'terminate': Stop the agent and close the connection for the given sessionId.
// - On 'user': Forward the message to the agent and broadcast its response to all clients.
// - On agent data: Broadcast to all clients.
//
// If an agent process crashes, the orchestrator will respawn it and retry the request, up to 3 times.

const SYSTEM_PROMPT = `
 You are a frontend development assistant. Developers talk to you through a chat interface exposed from their browser.
 Your task is to fulfill the user's request with minimal code changes that result in best user experience and most maintainable code.
 Do not assume that the user is familiar with the codebase at all. Provide detailed explanations of your actions and code changes.

 Follow modern frontend development best practices and repository guidelines. Read AGENTS.md and follow it as best as you can.
`;

type SessionId = string;

interface BaseClientMessage {
  sessionId: SessionId;
  type: 'initialize' | 'terminate' | 'message';
}

interface ClientInitializeMessage extends BaseClientMessage {
  type: 'initialize';
}

interface ClientTerminateMessage extends BaseClientMessage {
  type: 'terminate';
}

interface ClientUserMessage extends BaseClientMessage {
  message: string;
  type: 'message';
}

type ClientMessage = ClientInitializeMessage | ClientTerminateMessage | ClientUserMessage;

class Logger {
  info(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(args);
  }

  error(...args: any[]) {
    // eslint-disable-next-line no-console
    console.error(args);
  }
}

const logger = new Logger();

export class Orchestrator {
  private agents: Map<SessionId, ClaudeAgent> = new Map();
  private wss: WebSocket.WebSocketServer;

  constructor() {
    this.wss = new WebSocket.WebSocketServer({
      port: Number(process.env.AI_OVERLAY_PORT) || 8080,
    });

    this.wss.on('connection', ws => {
      ws.on('message', (message: ClientMessage) => {
        logger.info('[Orchestrator] Received message:', message);

        switch (message.type) {
          case 'initialize':
            this.initialize(message.sessionId);
            break;
          case 'terminate':
            this.terminate(message.sessionId);
            break;
          case 'message':
            this.agents.get(message.sessionId)?.send(message.message);
            break;
          default:
            break;
        }
      });
    });

    // Handle termination and related signals to gracefully shutdown
    process.on('SIGTERM', this.close.bind(this));
    process.on('SIGINT', this.close.bind(this));
  }

  initialize(sessionId: SessionId) {
    logger.info('[Orchestrator] Initializing agent for session:', sessionId);

    if (this.agents.has(sessionId)) {
      logger.info('[Orchestrator] Agent already exists for session:', sessionId);
      return;
    }

    const agent = new ClaudeAgent();
    agent.initialize();

    this.agents.set(sessionId, agent);
  }

  terminate(sessionId: SessionId) {
    logger.info('[Orchestrator] Terminating agent for session:', sessionId);
    this.agents.get(sessionId)?.close();
    this.agents.delete(sessionId);
  }

  close() {
    for (const [sessionId, agent] of this.agents.entries()) {
      this.agents.delete(sessionId);
      agent.close();
    }

    this.wss.close((err: unknown) => {
      if (err) {
        logger.error('Error closing WebSocket server:', err);
      }

      this.wss.clients.forEach(client => {
        client.send(JSON.stringify({type: 'terminate'}));
      });
    });
  }
}

abstract class Agent {
  status: 'initial' | 'pending' | 'error' | 'closed' = 'initial';
  abstract send(message: string): void;
  abstract close(): void;
}

class ClaudeAgent extends Agent {
  private agent: ChildProcess | null = null;

  constructor() {
    super();
    this.initialize();
  }

  initialize() {
    const command = 'claude';
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--append-system-prompt',
      SYSTEM_PROMPT,
    ];

    this.agent = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: '',
      },
    });

    this.status = 'pending';
    logger.info('[ClaudeAgent] Initializing claude process');

    this.agent.on('spawn', () => {
      this.status = 'initial';
      logger.info('[ClaudeAgent] Started claude process');
    });

    this.agent.on('error', error => {
      this.status = 'error';
      logger.error('[ClaudeAgent] Failed to start claude process:', error);
      // @TODO: restart the agent and retry the request
    });

    this.agent.stderr?.on('data', data => {
      // @TODO: attempt to understand and do some type of recovery if possible
      logger.error('[ClaudeAgent] Stderr:', data.toString());
    });

    this.agent.stdout?.on('data', data => {
      logger.info('[ClaudeAgent] Stdout:', data.toString());
      // @TODO: handle stdout from the agent
    });
  }

  send(message: string): void {
    throw new Error('Method not implemented.');
  }

  close(): void {
    this.agent?.kill();
    this.status = 'closed';
  }
}

const orchestrator = new Orchestrator();

//   agent.stdout.on('data', data => {
//     if (!hasReceivedData) {
//       hasReceivedData = true;
//     }

//     const output = data.toString();
//     buffer += output;

//     const lines = buffer.split('\n');

//     buffer = lines.pop() || '';

//     for (const line of lines) {
//       if (!line.trim()) continue;

//         '[Server] Processing line:',
//         line.substring(0, 200) + (line.length > 200 ? '...' : '')
//       );

//       if (!claudeSessionId) {
//         try {
//           const parsed = JSON.parse(line);

//           if (parsed.session_id) {
//             claudeSessionId = parsed.session_id;

//             if (ws.readyState === WebSocket.OPEN) {
//               const sessionInfoMessage = JSON.stringify({
//                 type: 'session_info',
//                 session_id: claudeSessionId,
//               });
//                 '[Server] Sending session_info message to client:',
//                 sessionInfoMessage
//               );
//               ws.send(sessionInfoMessage);
//             } else {
//               console.error('[Server] WebSocket not open, cannot send session_info');
//             }
//           } else {
//           }
//         } catch (parseError) {
//         }
//       }

//       if (ws.readyState === WebSocket.OPEN) {
//         ws.send(line);
//       }
//     }
//   });
