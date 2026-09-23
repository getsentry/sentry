import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {SidebarPage} from './sidebarPage';

describe('SidebarPage', () => {
  it('provides one main landmark and a complementary sidebar', () => {
    render(
      <SidebarPage data-test-id="page">
        <SidebarPage.Main>Main content</SidebarPage.Main>
        <SidebarPage.Aside>Sidebar content</SidebarPage.Aside>
      </SidebarPage>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByRole('complementary')).toHaveTextContent('Sidebar content');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('uses the established responsive 66/33 layout', () => {
    render(
      <SidebarPage data-test-id="page">
        <SidebarPage.Main>Main content</SidebarPage.Main>
        <SidebarPage.Aside>Sidebar content</SidebarPage.Aside>
      </SidebarPage>
    );

    const rules = getEmotionRules(screen.getByTestId('page'));

    expect(rules.some(rule => rule.includes('container-type: inline-size'))).toBe(true);
    expect(
      rules.some(
        rule =>
          rule.includes('@container (min-width: 1152px)') &&
          rule.includes('grid-template-columns: minmax(100px, auto) 325px')
      )
    ).toBe(true);
  });
});
