import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {AIInputSection, getAIToolInput} from './aiInput';
import {AIOutputSection, getAIToolOutput} from './aiOutput';
import {MCPInputSection} from './mcpInput';
import {MCPOutputSection} from './mcpOutput';

function makeMCPNode(attributes: Record<string, string | number>) {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      op: 'mcp.server',
      name: 'mcp.server',
      additional_attributes: attributes,
    }),
    {organization: OrganizationFixture()}
  );
}

function InputOutputSections({node}: {node: EapSpanNode}) {
  return (
    <Fragment>
      <AIInputSection node={node} />
      <AIOutputSection node={node} />
      <MCPInputSection node={node} />
      <MCPOutputSection node={node} />
    </Fragment>
  );
}

describe('MCP input and output', () => {
  it.each([undefined, 'tool'])(
    'renders dual-written content once with operation type %s',
    operationType => {
      const node = makeMCPNode({
        ...(operationType && {'gen_ai.operation.type': operationType}),
        'gen_ai.tool.call.arguments': '{"Topic":"canonical input"}',
        'gen_ai.tool.call.result': '{"content":[],"structuredContent":{"ok":false}}',
        'mcp.request.argument.topic': '"legacy input"',
        'mcp.tool.result.content': 'legacy output',
      });

      render(<InputOutputSections node={node} />);

      expect(screen.getAllByRole('region', {name: 'Input'})).toHaveLength(1);
      expect(screen.getAllByRole('region', {name: 'Output'})).toHaveLength(1);
      expect(screen.getByText('Topic')).toBeInTheDocument();
      expect(screen.getByText('structuredContent')).toBeInTheDocument();
      expect(screen.queryByText('legacy input')).not.toBeInTheDocument();
      expect(screen.queryByText('legacy output')).not.toBeInTheDocument();
    }
  );

  it('preserves Code Mode rendering for MCP tools', async () => {
    const code = 'for x in range(3):\n    print(x)';
    const input = {code, language: 'python'};
    const node = makeMCPNode({
      'gen_ai.operation.type': 'tool',
      'gen_ai.tool.name': 'execute_code',
      'gen_ai.tool.call.arguments': JSON.stringify(input),
      'gen_ai.tool.call.result': JSON.stringify({input, output: false}),
      'mcp.request.argument.code': 'legacy code',
      'mcp.tool.result.content': 'legacy output',
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/1/ai/code-explanation/',
      method: 'POST',
      body: {summary: 'Print numbers in a loop'},
      match: [MockApiClient.matchData(input)],
    });

    render(<InputOutputSections node={node} />);

    expect(await screen.findByText('Print numbers in a loop')).toBeInTheDocument();
    const inputSection = screen.getByRole('region', {name: 'Input'});
    expect(within(inputSection).getByText('python')).toBeInTheDocument();
    expect(
      within(inputSection).getByText(
        (_, element) => element?.tagName === 'CODE' && element.textContent === code
      )
    ).toBeInTheDocument();
    const output = screen.getByRole('region', {name: 'Output'});
    expect(within(output).getByText('Boolean')).toBeInTheDocument();
    expect(within(output).getByText('false')).toBeInTheDocument();
    expect(within(output).getByRole('button', {name: 'Copy output'})).toBeInTheDocument();
    expect(screen.queryByText('legacy code')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy output')).not.toBeInTheDocument();
  });

  it.each(['{"content":[]}', '{"structuredContent":{}}', '{"structuredContent":false}'])(
    'renders canonical-only output %s',
    output => {
      const node = makeMCPNode({
        'gen_ai.operation.type': 'tool',
        'gen_ai.tool.call.result': output,
      });

      render(<InputOutputSections node={node} />);

      expect(screen.getAllByRole('region', {name: 'Output'})).toHaveLength(1);
      expect(getAIToolOutput(node)).toBe(output);
    }
  );

  it.each<{attributes: Record<string, string | number>; name: string}>([
    {name: 'singleton', attributes: {'mcp.tool.result.content': 'singleton'}},
    {name: 'empty singleton', attributes: {'mcp.tool.result.content': ''}},
    {
      name: 'indexed with gaps',
      attributes: {
        'mcp.tool.result.0.content': 'first',
        'mcp.tool.result.2.content': 'third',
      },
    },
    {
      name: 'error response',
      attributes: {
        'mcp.tool.result.0.content': 'error response',
        'mcp.tool.result.is_error': 'true',
      },
    },
    {
      name: 'oversized result',
      attributes: {'mcp.tool.result.0.content': 'x'.repeat(20_001)},
    },
  ])('renders $name legacy fields when canonical output is absent', ({attributes}) => {
    const node = makeMCPNode(attributes);

    render(<InputOutputSections node={node} />);

    const output = screen.getByRole('region', {name: 'Output'});
    for (const key of Object.keys(attributes)) {
      expect(
        within(output).getByText(key.replace('mcp.tool.result.', ''))
      ).toBeInTheDocument();
    }
    expect(getAIToolOutput(node)).toEqual(
      Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
          key.replace('mcp.tool.result.', ''),
          value,
        ])
      )
    );
  });

  it('does not create an output section when only uncaptured-output metadata is present', () => {
    const node = makeMCPNode({
      'gen_ai.operation.type': 'tool',
      'mcp.tool.result.content_count': 1,
      'mcp.tool.result.content_type': 'text',
      'mcp.tool.result.is_error': 'false',
    });

    render(<InputOutputSections node={node} />);

    expect(screen.queryByRole('region', {name: 'Output'})).not.toBeInTheDocument();
  });

  it('renders empty canonical arguments instead of stale legacy arguments', () => {
    const node = makeMCPNode({
      'gen_ai.tool.call.arguments': '{}',
      'mcp.request.argument.topic': '"legacy input"',
    });

    render(<InputOutputSections node={node} />);

    expect(screen.getByRole('region', {name: 'Input'})).toBeInTheDocument();
    expect(screen.queryByText('topic')).not.toBeInTheDocument();
    expect(getAIToolInput(node)).toBe('{}');
  });

  it('does not create input or output sections when neither was captured', () => {
    render(<InputOutputSections node={makeMCPNode({})} />);

    expect(screen.queryByRole('region', {name: 'Input'})).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Output'})).not.toBeInTheDocument();
  });

  it('keeps the AI input and output sections for a non-MCP tool', () => {
    const node = new EapSpanNode(
      null,
      makeEAPSpan({
        op: 'gen_ai.execute_tool',
        name: 'gen_ai.execute_tool example',
        additional_attributes: {
          'gen_ai.operation.type': 'tool',
          'gen_ai.tool.call.arguments': '{"Topic":"input"}',
          'gen_ai.tool.call.result': '{"ok":true}',
        },
      }),
      {organization: OrganizationFixture()}
    );

    render(<InputOutputSections node={node} />);

    expect(
      within(screen.getByRole('region', {name: 'Input'})).getByText('Topic')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Output'})).getByText('ok')
    ).toBeInTheDocument();
  });

  it('does not render MCP fallback content on non-MCP spans', () => {
    const node = new EapSpanNode(
      null,
      makeEAPSpan({
        op: 'gen_ai.generate_text',
        name: 'gen_ai.generate_text example',
        additional_attributes: {
          'gen_ai.operation.type': 'chat',
          'gen_ai.prompt.variable.Topic': 'prompt variable',
          'mcp.request.argument.topic': 'legacy argument',
          'mcp.tool.result.content': 'legacy output',
        },
      }),
      {organization: OrganizationFixture()}
    );

    render(<InputOutputSections node={node} />);

    expect(screen.queryByRole('region', {name: 'Input'})).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Output'})).not.toBeInTheDocument();
  });

  it('keeps prompt variables case-sensitive and prompt results separate from tool output', () => {
    const node = makeMCPNode({
      'gen_ai.prompt.variable.Topic': 'canonical prompt',
      'mcp.request.argument.topic': '"legacy prompt"',
      'mcp.prompt.result.0.role': 'user',
      'mcp.prompt.result.0.content': 'prompt output',
    });

    render(<InputOutputSections node={node} />);

    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.getAllByRole('region', {name: 'Output'})).toHaveLength(1);
    expect(screen.getByText('0.content')).toBeInTheDocument();
    expect(screen.queryByText('legacy prompt')).not.toBeInTheDocument();
    expect(getAIToolInput(node)).toEqual({Topic: 'canonical prompt'});
    expect(getAIToolOutput(node)).toBeUndefined();
  });
});
