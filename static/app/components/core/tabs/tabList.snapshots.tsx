import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider} from '@emotion/react';

import {TabList, Tabs} from '@sentry/scraps/tabs';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

const TABS = [
  {key: 'details', label: 'Details'},
  {key: 'activity', label: 'Activity'},
  {key: 'user-feedback', label: 'User Feedback'},
  {key: 'attachments', label: 'Attachments'},
] as const;

const allVariants = ['flat', 'floating'] as const;
const allSizes = ['md', 'sm', 'xs'] as const;

describe('TabList', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        // TabList renders tab links and calls useNavigate(), which needs a
        // router in context even under SSR.
        <MemoryRouter>
          <ThemeProvider theme={themes[themeName]}>
            {/* Padding so selection indicators / focus rings aren't clipped by
              rootElement.screenshot()'s border-box crop. */}
            <div style={{padding: 8}}>{children}</div>
          </ThemeProvider>
        </MemoryRouter>
      );
    }

    describe.each(allVariants)('variant %s', variant => {
      describe.each(allSizes)('size %s', size => {
        it.snapshot(
          'horizontal',
          () => (
            <Wrapper>
              <Tabs size={size} defaultValue="activity">
                <TabList variant={variant}>
                  {TABS.map(tab => (
                    <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                  ))}
                </TabList>
              </Tabs>
            </Wrapper>
          ),
          {
            group: `${themeName} – horizontal`,
            display_name: `${themeName} / ${variant} / ${size} / horizontal`,
            tags: {variant: String(variant), size: String(size), area: 'core'},
          }
        );
      });
    });

    describe.each(allVariants)('vertical variant %s', variant => {
      it.snapshot(
        'vertical',
        () => (
          <Wrapper>
            <Tabs orientation="vertical" defaultValue="activity">
              <TabList variant={variant}>
                {TABS.map(tab => (
                  <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                ))}
              </TabList>
            </Tabs>
          </Wrapper>
        ),
        {
          group: `${themeName} – vertical`,
          display_name: `${themeName} / ${variant} / vertical`,
          tags: {variant: String(variant), orientation: 'vertical', area: 'core'},
        }
      );
    });

    it.snapshot(
      'disabled',
      () => (
        <Wrapper>
          <Tabs disabled defaultValue="activity">
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </Wrapper>
      ),
      {
        group: `${themeName} – disabled`,
        display_name: `${themeName} / disabled`,
        tags: {state: 'disabled', area: 'core'},
      }
    );

    it.snapshot(
      'single disabled tab',
      () => (
        <Wrapper>
          <Tabs defaultValue="details">
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab.key} disabled={tab.key === 'user-feedback'}>
                  {tab.label}
                </TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </Wrapper>
      ),
      {
        group: `${themeName} – disabled`,
        display_name: `${themeName} / single disabled tab`,
        tags: {state: 'single-disabled', area: 'core'},
      }
    );
  });
});
