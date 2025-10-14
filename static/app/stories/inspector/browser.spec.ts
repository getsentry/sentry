/* eslint-disable import/no-nodejs-modules */
/* eslint-disable no-console */

import {fileURLToPath} from 'node:url';

import WebSocket from 'ws';

/**
 * Simple WebSocket client for communicating with the claude.dev.ts Orchestrator.
 *
 * The Orchestrator expects messages with the following structure:
 * - { sessionId: string, type: 'initialize' } - Initialize a new agent session
 * - { sessionId: string, type: 'message', message: string } - Send a message to the agent
 * - { sessionId: string, type: 'terminate' } - Terminate the agent session
 */

interface ClientMessage {
  sessionId: string;
  type: 'initialize' | 'terminate' | 'message';
  message?: string;
}

class ClaudeWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private port: number;

  constructor(sessionId: string, port = 8080) {
    this.sessionId = sessionId;
    this.port = port;

    this.ws = new WebSocket(`ws://localhost:${this.port}`);
  }

  connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on('open', () => {
        console.log('[Client] Connected to Orchestrator');
        resolve();
      });

      this.ws.on('error', error => {
        console.error('[Client] WebSocket error:', error);
        reject(error);
      });

      this.ws.on('message', data => {
        const message = data.toString();
        console.log('[Client] Received:', message);

        try {
          const parsed = JSON.parse(message);
          this.handleMessage(parsed);
        } catch (error) {
          console.log('[Client] Received non-JSON message:', message);
        }
      });

      this.ws.on('close', () => {
        console.log('[Client] Connection closed');
      });
    });
  };

  private handleMessage(message: any): void {
    if (message.type === 'terminate') {
      console.log('[Client] Server terminated the connection');
    } else if (message.session_id) {
      console.log('[Client] Received session info:', message.session_id);
    } else {
      console.log('[Client] Agent response:', message);
    }
  }

  initialize(): void {
    const message: ClientMessage = {
      sessionId: this.sessionId,
      type: 'initialize',
    };
    this.send(message);
    console.log('[Client] Initialized session:', this.sessionId);
  }

  sendMessage(text: string): void {
    const message: ClientMessage = {
      sessionId: this.sessionId,
      type: 'message',
      message: text,
    };
    this.send(message);
    console.log('[Client] Sent message:', text);
  }

  terminate(): void {
    const message: ClientMessage = {
      sessionId: this.sessionId,
      type: 'terminate',
    };
    this.send(message);
    console.log('[Client] Terminated session:', this.sessionId);
  }

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[Client] WebSocket is not open');
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Example usage demonstrating the client
async function main() {
  const sessionId = 'test-session-' + Date.now();
  const client = new ClaudeWebSocketClient(sessionId);

  try {
    // Connect to the orchestrator
    await client.connect();

    // Initialize a new agent session
    client.initialize();

    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send a message to the agent
    client.sendMessage('Hello, Claude! Can you help me with something?');

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Send another message
    client.sendMessage('What is 2 + 2?');

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Terminate the session
    client.terminate();

    // Wait a bit before closing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Close the connection
    client.close();
  } catch (error) {
    console.error('[Client] Error:', error);
    client.close();
  }
}

// Run the example if this file is executed directly
const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] === modulePath) {
  main().catch(console.error);
}

export {ClaudeWebSocketClient};
