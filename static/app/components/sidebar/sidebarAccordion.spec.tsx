import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SidebarAccordion} from 'sentry/components/sidebar/sidebarAccordion';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconStar} from 'sentry/icons';

describe('SidebarAccordion', function () {
  it('marks only the selected child as active', function () {
    window.location.pathname = '/performance/queries?sort=tpm()';

    render(
      <SidebarAccordion
        icon={<IconStar />}
        label="Performance"
        to="/performance/"
        id="performance"
        orientation="left"
      >
        <SidebarItem
          label="Queries"
          to="/performance/queries"
          id="queries"
          icon={<IconStar />}
          orientation="left"
        />
      </SidebarAccordion>
    );

    expect(screen.getByRole('link', {name: 'Performance Queries'})).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByRole('link', {name: 'Queries'})).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
