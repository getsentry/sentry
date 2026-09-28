import {MemoryRouter} from 'react-router-dom';

import {TabList, Tabs} from '@sentry/scraps/tabs';

const TABS = [
  {key: 'details', label: 'Details'},
  {key: 'activity', label: 'Activity'},
  {key: 'user-feedback', label: 'User Feedback'},
  {key: 'attachments', label: 'Attachments'},
] as const;

const allVariants = ['flat', 'floating'] as const;
const allSizes = ['md', 'sm', 'xs'] as const;

describe('TabList', () => {
  function Wrapper({children}: {children: React.ReactNode}) {
    return (
      // TabList renders tab links and calls useNavigate(), which needs a
      // router in context even under SSR.
      <MemoryRouter>{children}</MemoryRouter>
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
      tags: {state: 'single-disabled', area: 'core'},
    }
  );
});
