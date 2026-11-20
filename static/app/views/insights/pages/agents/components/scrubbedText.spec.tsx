import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {annotate, splitAnnotations, stripAnnotations} from '@sentry/scraps/markdown';

import {markScrubbedValue, ScrubbedText, splitScrubbedJson} from './scrubbedText';

const ATTRIBUTE = 'gen_ai.input.messages';
const VALUE = '[{"role":"user","content":"Mail [email] about ****-1234"}]';

function meta(rem: Array<[string, string, number, number]>) {
  return {[ATTRIBUTE]: {meta: {value: {'': {rem, len: 0}}}}};
}

function range(text: string): [number, number] {
  const start = VALUE.indexOf(text);
  return [start, start + text.length];
}

function markedContent(rem: Array<[string, string, number, number]>, slug = 'project') {
  const marked = markScrubbedValue(ATTRIBUTE, VALUE, meta(rem), slug);
  return JSON.parse(marked)[0].content as string;
}

describe('markScrubbedValue', () => {
  it('marks the ranges the remarks point at, whatever they contain', () => {
    const content = markedContent([
      ['@email:replace', 's', ...range('[email]')],
      ['project:0', 'm', ...range('****')],
    ]);

    expect(splitAnnotations(content)).toEqual([
      'Mail ',
      {
        text: '[email]',
        data: JSON.stringify({
          ruleId: '@email:replace',
          remark: 's',
          projectSlug: 'project',
        }),
      },
      ' about ',
      {
        text: '****',
        data: JSON.stringify({ruleId: 'project:0', remark: 'm', projectSlug: 'project'}),
      },
      '-1234',
    ]);
  });

  it('marks the ranges of one rule with a shared reference to it', () => {
    const value = '[{"role":"user","content":"Mail [email] or [email]"}]';
    const first = value.indexOf('[email]');
    const second = value.lastIndexOf('[email]');
    const rem: Array<[string, string, number, number]> = [
      ['@email:replace', 's', first, first + '[email]'.length],
      ['@email:replace', 's', second, second + '[email]'.length],
    ];
    const marked = markScrubbedValue(ATTRIBUTE, value, meta(rem), 'project');
    const rule = JSON.stringify({
      ruleId: '@email:replace',
      remark: 's',
      projectSlug: 'project',
    });

    // Each range only adds an opening mark, a reference, a separator, and a
    // closing mark, rather than its own copy of the rule.
    expect(marked).toHaveLength(value.length + 2 * 4);
    const content: string = JSON.parse(marked)[0].content;
    const [firstMarked, secondMarked] = content.slice('Mail '.length).split(' or ');
    expect(firstMarked).toBe(secondMarked);
    expect(splitAnnotations(content)).toEqual([
      'Mail ',
      {text: '[email]', data: rule},
      ' or ',
      {text: '[email]', data: rule},
    ]);

    // The same rule in another project links elsewhere, so it gets its own.
    const otherContent: string = JSON.parse(
      markScrubbedValue(ATTRIBUTE, value, meta(rem), 'other-project')
    )[0].content;
    expect(otherContent).not.toBe(content);
    expect(splitAnnotations(otherContent)[1]).toEqual({
      text: '[email]',
      data: JSON.stringify({
        ruleId: '@email:replace',
        remark: 's',
        projectSlug: 'other-project',
      }),
    });
  });

  it('reads the ranges as UTF-8 byte offsets', () => {
    // Relay counts bytes: "é" takes 2, "🙂" takes 4 (and 2 UTF-16 code units).
    const value = '[{"role":"user","content":"Café 🙂 mail [email] now"}]';
    const start = new TextEncoder().encode(
      value.slice(0, value.indexOf('[email]'))
    ).length;
    const marked = markScrubbedValue(
      ATTRIBUTE,
      value,
      meta([['@email:replace', 's', start, start + '[email]'.length]]),
      'project'
    );

    expect(splitAnnotations(JSON.parse(marked)[0].content)).toEqual([
      'Café 🙂 mail ',
      {
        text: '[email]',
        data: JSON.stringify({
          ruleId: '@email:replace',
          remark: 's',
          projectSlug: 'project',
        }),
      },
      ' now',
    ]);
  });

  it('ignores ranges that do not fit the value', () => {
    const marked = markScrubbedValue(
      ATTRIBUTE,
      VALUE,
      meta([['@email:replace', 's', 10, VALUE.length + 5]]),
      'project'
    );

    expect(marked).toBe(VALUE);
  });

  it('keeps JSON valid when a range crosses its syntax', () => {
    const marked = markScrubbedValue(
      ATTRIBUTE,
      VALUE,
      meta([['@email:replace', 's', 0, 4]]),
      'project'
    );

    expect(marked).toBe(VALUE);
  });

  it('keeps a JSON string valid when a range crosses its quotes', () => {
    const value = '"Mail [email]"';
    const marked = markScrubbedValue(
      ATTRIBUTE,
      value,
      meta([['@email:replace', 's', 0, 5]]),
      'project'
    );

    expect(marked).toBe(value);
  });

  it.each([
    'gen_ai.request.messages',
    'gen_ai.response.text',
    'gen_ai.response.tool_calls',
    'gen_ai.tool.input',
    'gen_ai.tool.output',
  ])('marks %s, a name the attribute had before', attribute => {
    const marked = markScrubbedValue(
      attribute,
      'Mail [email]',
      {
        [attribute]: {
          meta: {value: {'': {rem: [['@email:replace', 's', 5, 12]], len: 0}}},
        },
      },
      'project'
    );

    expect(splitAnnotations(marked)).toEqual([
      'Mail ',
      expect.objectContaining({text: '[email]'}),
    ]);
  });

  it('leaves attributes that are not rendered as AI content alone', () => {
    const marked = markScrubbedValue(
      'user.email',
      '[email]',
      {
        'user.email': {
          meta: {value: {'': {rem: [['@email:replace', 's', 0, 7]], len: 0}}},
        },
      },
      'project'
    );

    expect(marked).toBe('[email]');
  });
});

describe('ScrubbedText', () => {
  const piiConfig = JSON.stringify({
    rules: {0: {type: 'email', redaction: {method: 'replace', text: '[email]'}}},
    applications: {$string: ['0']},
  });
  const organization = OrganizationFixture({relayPiiConfig: piiConfig});
  const project = DetailedProjectFixture({
    slug: 'project-slug',
    relayPiiConfig: piiConfig,
  });
  const projectSettings = `/settings/${organization.slug}/projects/project-slug/security-and-privacy/`;

  let projectRequest: jest.Mock;

  beforeEach(() => {
    projectRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/`,
      body: project,
    });
  });

  function renderWithRule(ruleId: string, remark = 's') {
    const content = markedContent(
      [[ruleId, remark, ...range('[email]')]],
      'project-slug'
    );
    render(<ScrubbedText>{content}</ScrubbedText>, {organization});
    return content;
  }

  it('explains default scrubbing with a link to the project settings', async () => {
    const content = renderWithRule('@email:replace');

    expect(stripAnnotations(content)).toBe('Mail [email] about ****-1234');
    // The project's rules are only needed once the tooltip opens.
    expect(projectRequest).not.toHaveBeenCalled();
    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByText(/Replaced because of a data scrubbing rule/)
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: 'project-slug'})).toHaveAttribute(
      'href',
      projectSettings
    );
  });

  it('links to rules added in the project settings', async () => {
    renderWithRule('project:0');

    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByRole('link', {name: 'data scrubbing rule'})
    ).toHaveAttribute('href', `${projectSettings}advanced-data-scrubbing/0/`);
    expect(screen.getByRole('link', {name: 'project-slug'})).toHaveAttribute(
      'href',
      projectSettings
    );
  });

  it('links to rules added in the organization settings', async () => {
    renderWithRule('organization:0');

    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByRole('link', {name: 'data scrubbing rule'})
    ).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/0/`
    );
  });

  it('leaves out the description of the rule, which can get long', async () => {
    renderWithRule('project:0');

    await userEvent.hover(screen.getByText('[email]'));

    expect(await screen.findByRole('link', {name: 'data scrubbing rule'})).toBeVisible();
    expect(screen.queryByText(/Email addresses/)).not.toBeInTheDocument();
  });

  it('names how the value was scrubbed', async () => {
    renderWithRule('project:0', 'm');

    await userEvent.hover(screen.getByText('[email]'));

    expect(await screen.findByText(/Masked because of/)).toBeInTheDocument();
  });

  it('renders text without marks as is', () => {
    render(<ScrubbedText>Contact [email] here</ScrubbedText>);

    expect(screen.getByText('Contact [email] here')).toBeInTheDocument();
  });
});

describe('splitScrubbedJson', () => {
  const rule = JSON.stringify({ruleId: '@email:replace', remark: 's'});
  const email = annotate('[email]', rule);

  it('splits marked strings into the plain JSON and the meta of its redactions', () => {
    const split = splitScrubbedJson({
      to: email,
      messages: ['plain', `Mail ${email} now`],
      count: 2,
    });

    expect(split.value).toEqual({
      to: '[email]',
      messages: ['plain', 'Mail [email] now'],
      count: 2,
    });
    expect(split.meta).toEqual({
      to: {
        '': {
          rem: [['@email:replace', 's']],
          chunks: [
            {type: 'redaction', text: '[email]', rule_id: '@email:replace', remark: 's'},
            {type: 'text', text: '', rule_id: ''},
          ],
        },
      },
      messages: {
        1: {
          '': {
            rem: [['@email:replace', 's']],
            chunks: [
              {type: 'text', text: 'Mail ', rule_id: ''},
              {
                type: 'redaction',
                text: '[email]',
                rule_id: '@email:replace',
                remark: 's',
              },
              {type: 'text', text: ' now', rule_id: ''},
            ],
          },
        },
      },
    });
  });

  it('removes the marks of object keys', () => {
    expect(splitScrubbedJson({[email]: {[`id ${email}`]: 1}})).toEqual({
      value: {'[email]': {'id [email]': 1}},
      meta: undefined,
    });
  });

  it('returns no meta for JSON without marks', () => {
    const json = {to: '[email]', nested: [{a: null}]};

    expect(splitScrubbedJson(json)).toEqual({value: json, meta: undefined});
  });
});
