import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {AIInputSection} from './aiInput';
import {AIOutputSection} from './aiOutput';
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
  it('renders dual-written content once without an operation type', () => {
    const node = makeMCPNode({
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
  });

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

  it('keeps separately encoded legacy Code Mode arguments as JSON', () => {
    const node = makeMCPNode({
      'gen_ai.tool.name': 'execute_code',
      'mcp.request.argument.code': JSON.stringify('print(1)'),
      'mcp.request.argument.language': JSON.stringify('python'),
    });

    render(<InputOutputSections node={node} />);

    const input = screen.getByRole('region', {name: 'Input'});
    expect(within(input).getByText('code')).toBeInTheDocument();
    expect(within(input).getByText('language')).toBeInTheDocument();
    expect(within(input).getByText('"print(1)"', {exact: false})).toBeInTheDocument();
    expect(within(input).getByText('"python"', {exact: false})).toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Summary'})).not.toBeInTheDocument();
  });

  it('renders canonical-only structured output', () => {
    const node = makeMCPNode({
      'gen_ai.tool.call.result': '{"structuredContent":false}',
    });

    render(<InputOutputSections node={node} />);

    const output = screen.getByRole('region', {name: 'Output'});
    expect(within(output).getByText('structuredContent')).toBeInTheDocument();
    expect(within(output).getByText('false')).toBeInTheDocument();
  });

  it('renders original legacy indices and error metadata when canonical output is absent', () => {
    const node = makeMCPNode({
      'mcp.tool.result.0.content': 'first',
      'mcp.tool.result.2.content': 'third',
      'mcp.tool.result.is_error': 'true',
    });

    render(<InputOutputSections node={node} />);

    const output = screen.getByRole('region', {name: 'Output'});
    expect(within(output).getByText('0.content')).toBeInTheDocument();
    expect(within(output).getByText('"first"')).toBeInTheDocument();
    expect(within(output).getByText('2.content')).toBeInTheDocument();
    expect(within(output).getByText('"third"')).toBeInTheDocument();
    expect(within(output).getByText('is_error')).toBeInTheDocument();
    expect(within(output).getByText('"true"')).toBeInTheDocument();
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
  });
});
