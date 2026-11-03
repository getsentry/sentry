import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {splitAnnotations, stripAnnotations} from '@sentry/scraps/markdown';

import {
  markScrubbedValue,
  ScrubbedText,
} from 'sentry/views/insights/pages/agents/components/scrubbedText';

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
  const organization = OrganizationFixture();

  function renderWithRule(ruleId: string) {
    const content = markedContent([[ruleId, 's', ...range('[email]')]], 'project-slug');
    render(<ScrubbedText>{content}</ScrubbedText>, {organization});
    return content;
  }

  it('explains default scrubbing with a link to the settings', async () => {
    const content = renderWithRule('@email:replace');

    expect(stripAnnotations(content)).toBe('Mail [email] about ****-1234');
    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByText(/Replaced because of a default data scrubbing rule/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'project-slug'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/project-slug/security-and-privacy/`
    );
  });

  it('links to rules added in the project settings', async () => {
    renderWithRule('project:0');

    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByRole('link', {name: 'data scrubbing rule'})
    ).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/project-slug/security-and-privacy/advanced-data-scrubbing/0/`
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('links to rules added in the organization settings', async () => {
    renderWithRule('organization:1');

    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByRole('link', {name: 'data scrubbing rule'})
    ).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/1/`
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders text without marks as is', () => {
    render(<ScrubbedText>Contact [email] here</ScrubbedText>);

    expect(screen.getByText('Contact [email] here')).toBeInTheDocument();
  });
});
