import {getLegacyMCPToolResult, getMCPRequestArguments} from './mcpContent';

describe('getLegacyMCPToolResult', () => {
  it.each(['plain text', '{"ok":false}', ''])(
    'preserves singleton content %j',
    content => {
      expect(
        getLegacyMCPToolResult({
          'mcp.tool.result.content': content,
          'mcp.tool.result.content_type': 'text',
          'mcp.tool.result.content_count': 1,
        })
      ).toEqual({content, content_type: 'text', content_count: 1});
    }
  );

  it('preserves partial fields and original indices when canonical output is absent', () => {
    expect(
      getLegacyMCPToolResult({
        'mcp.tool.result.0.content': 'first',
        'mcp.tool.result.0.content_type': 'text',
        'mcp.tool.result.2.resource_uri': 'file:///example.txt',
        'mcp.tool.result.2.resource_mime_type': 'text/plain',
        'mcp.tool.result.content_count': 3,
        'mcp.tool.result.is_error': true,
      })
    ).toEqual({
      '0.content': 'first',
      '0.content_type': 'text',
      '2.resource_uri': 'file:///example.txt',
      '2.resource_mime_type': 'text/plain',
      content_count: 3,
      is_error: true,
    });
  });

  it('does not treat metadata recorded without outputs as captured content', () => {
    expect(
      getLegacyMCPToolResult({
        'mcp.tool.result.0.content_type': 'text',
        'mcp.tool.result.1.content_type': 'image',
        'mcp.tool.result.content_count': 2,
        'mcp.tool.result.is_error': false,
      })
    ).toBeUndefined();
    expect(getLegacyMCPToolResult(undefined)).toBeUndefined();
  });
});

describe('getMCPRequestArguments', () => {
  it('preserves legacy arguments when canonical prompt variables are unavailable', () => {
    expect(getMCPRequestArguments({'mcp.request.argument.topic': '"example"'})).toEqual({
      topic: '"example"',
    });
  });

  it('prefers case-sensitive prompt variables without discarding uncaptured legacy arguments', () => {
    expect(
      getMCPRequestArguments({
        'gen_ai.prompt.variable.Topic': 'canonical',
        'gen_ai.prompt.variable.topic': 'distinct',
        'mcp.request.argument.topic': '"legacy"',
        'mcp.request.argument.other': '"remaining"',
        'mcp.request.argument.name': '"prompt"',
      })
    ).toEqual({
      Topic: 'canonical',
      topic: 'distinct',
      other: '"remaining"',
      name: '"prompt"',
    });
  });
});
