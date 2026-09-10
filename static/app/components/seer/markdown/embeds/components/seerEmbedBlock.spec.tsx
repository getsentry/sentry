import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Tag} from '@sentry/scraps/badge';

import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import {IconDashboard} from 'sentry/icons';

function renderBlock(props: Partial<Parameters<typeof SeerEmbedBlock>[0]> = {}) {
  return render(
    <SeerEmbedBlock
      href="/organizations/org-slug/dashboard/123/"
      icon={IconDashboard}
      linkLabel="View Dashboard"
      testId="seer-block"
      title="Cache Slowdown"
      {...props}
    >
      <div>Preview body</div>
    </SeerEmbedBlock>
  );
}

describe('SeerEmbedBlock', () => {
  it('names the block with a toggle and links out separately', () => {
    renderBlock();

    // The resource's name is the collapse control, not a link -- aiming at the
    // title must not navigate away from the conversation.
    expect(screen.getByRole('button', {name: 'Cache Slowdown'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.queryByRole('link', {name: 'Cache Slowdown'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/123/'
    );
  });

  it('collapses and expands the preview', async () => {
    renderBlock();

    const toggle = screen.getByRole('button', {name: 'Cache Slowdown'});
    expect(screen.getByText('Preview body')).toBeVisible();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Preview body')).not.toBeVisible();
    // The link stays reachable while collapsed -- a collapsed card is still a
    // pointer to its resource.
    expect(screen.getByRole('link', {name: 'View Dashboard'})).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Preview body')).toBeVisible();
  });

  it('starts collapsed when the embed asks for it', () => {
    renderBlock({defaultExpanded: false});

    expect(screen.getByRole('button', {name: 'Cache Slowdown'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Preview body')).not.toBeVisible();
  });

  it('renders a badge between the title and the link', () => {
    renderBlock({badge: <Tag variant="muted">Aggregate</Tag>});

    expect(screen.getByText('Aggregate')).toBeInTheDocument();
  });

  it('renders nothing for the link when the href is unsafe', () => {
    // eslint-disable-next-line no-script-url
    renderBlock({href: 'javascript:alert(1)'});

    // `ResourceLink` refuses anything that is not an http(s) URL or an
    // app-relative path, so the header simply has no link.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cache Slowdown'})).toBeInTheDocument();
  });
});
