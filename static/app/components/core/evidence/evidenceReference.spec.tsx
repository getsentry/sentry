import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EvidenceReference} from '@sentry/scraps/evidence';

describe('EvidenceReference', () => {
  describe('button variant', () => {
    it('renders the type prefix and value as a link when to is set', () => {
      render(
        <EvidenceReference variant="button" type="trace" value="a3805648" to="/trace/" />
      );

      const link = screen.getByRole('button', {name: 'Trace: a3805648'});
      expect(link).toHaveAttribute('href', '/trace/');
    });

    it('renders an interactive button when only onClick is set', () => {
      const onClick = jest.fn();
      render(
        <EvidenceReference
          variant="button"
          type="issue"
          value="SEER-123"
          onClick={onClick}
        />
      );

      const button = screen.getByRole('button', {name: 'Issue: SEER-123'});
      expect(button).toBeEnabled();
    });

    it('renders a non-interactive chip when neither to nor onClick is set', () => {
      render(<EvidenceReference variant="button" type="replay" value="67ad746a" />);

      expect(screen.getByRole('button', {name: 'Replay: 67ad746a'})).toBeDisabled();
    });

    it('omits the type prefix for code', () => {
      render(
        <EvidenceReference
          variant="button"
          type="code"
          value="src/foo.py:12"
          to="/foo/"
        />
      );

      expect(screen.getByRole('button', {name: 'src/foo.py:12'})).toBeInTheDocument();
      expect(screen.queryByText(/Code:/)).not.toBeInTheDocument();
    });
  });

  describe('link variant', () => {
    it('renders a relative href as an inline link with no type prefix', () => {
      render(
        <EvidenceReference
          variant="link"
          type="issue"
          value="SEER-123"
          href="/issues/123/"
        />
      );

      const link = screen.getByRole('link', {name: 'SEER-123'});
      expect(link).toHaveAttribute('href', '/issues/123/');
      expect(screen.queryByText(/Issue:/)).not.toBeInTheDocument();
    });

    it('renders nothing for an unsafe href', () => {
      render(
        <EvidenceReference
          variant="link"
          type="docs"
          value="Getting started"
          href="data:text/html,<b>unsafe</b>"
        />
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
