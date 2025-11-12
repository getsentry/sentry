import type {
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

export const mcp: OnboardingConfig = {
  install: () => {
    const packageName = 'sentry-sdk';

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t(
              'To enable MCP monitoring, you need to install the Sentry SDK with a minimum version of 2.43.0 or higher.'
            ),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
    ];
  },
  configure: params => {
    const mcpLowLevelStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for MCP low-level monitoring:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t('Set up your Low-level MCP server:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from mcp.server.lowlevel import Server
from mcp.types import Tool, TextContent

server = Server("mcp-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available tools."""
    return [
        Tool(
            name="calculate_sum",
            description="Add two numbers together",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {"type": "number", "description": "First number"},
                    "b": {"type": "number", "description": "Second number"},
                },
                "required": ["a", "b"],
            },
        )
    ]
@server.call_tool()
async def call_tool(name: str, arguments) -> list[TextContent]:
    """Handle tool execution based on tool name."""

    if name == "calculate_sum":
        a = arguments.get("a", 0)
        b = arguments.get("b", 0)
        result = a + b
        return [TextContent(type="text", text=f"The sum of {a} and {b} is {result}")]

`,
        },
      ],
    };

    const mcpFastMcpStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for MCP low-level monitoring:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t('Set up your FastMCP server:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from mcp.server.fastmcp import FastMCP
# from fastmcp import FastMCP if you are using the standalone version

mcp = FastMCP("mcp-server")

@mcp.tool()
async def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
`,
        },
      ],
    };

    const manualStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for manual MCP instrumentation:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
)
`,
        },
      ],
    };

    const selected = (params.platformOptions as any)?.integration ?? 'mcp_fastmcp';
    if (selected === 'mcp_fastmcp') {
      return [mcpFastMcpStep];
    }
    if (selected === 'manual') {
      return [manualStep];
    }
    return [mcpLowLevelStep];
  },
  verify: params => {
    const mcpVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that MCP monitoring is working correctly by triggering some MCP server interactions in your application.'
          ),
        },
      ],
    };

    const manualVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that MCP monitoring is working correctly by running your manually instrumented code:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import json
import sentry_sdk

# Invoke Agent span
with sentry_sdk.start_span(op="mcp.server", name="tools/call calculate_sum") as span:
    span.set_data("mcp.method.name", "tools/call")
    span.set_data("mcp.request.argument.a", "1")
    span.set_data("mcp.request.argument.b", "2")
    span.set_data("mcp.request.id", 123)
    span.set_data("mcp.session.id", "c6d1c6a4c35843d5bdf0f9d88d11c183")
    span.set_data("mcp.tool.name", "calculate_sum")
    span.set_data("mcp.tool.result.content_count", 1)
    span.set_data("mcp.transport", "stdio")
`,
        },
      ],
    };
    const selected = (params.platformOptions as any)?.integration ?? 'mcp_fastmcp';
    if (selected === 'manual') {
      return [manualVerifyStep];
    }
    return [mcpVerifyStep];
  },
  nextSteps: () => [],
};
