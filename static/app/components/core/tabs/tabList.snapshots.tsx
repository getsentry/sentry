import {Flex, Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

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
    return <div style={{padding: 8}}>{children}</div>;
  }

  describe.each(allVariants)('variant %s', variant => {
    describe.each(allSizes)('size %s', size => {
      it.snapshot(
        'horizontal',
        () => (
          <Wrapper>
            <Tabs<(typeof TABS)[number]['key']> size={size} defaultValue="activity">
              {({TabList}) => (
                <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
                  <TabList variant={variant}>
                    {TABS.map(tab => (
                      <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                    ))}
                  </TabList>
                </Stack>
              )}
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
          <Tabs<(typeof TABS)[number]['key']>
            orientation="vertical"
            defaultValue="activity"
          >
            {({TabList}) => (
              <Flex
                direction="row"
                flexGrow={1}
                minWidth="0"
                flexBasis="auto"
                alignSelf="auto"
                height="100%"
                align="stretch"
              >
                <TabList variant={variant}>
                  {TABS.map(tab => (
                    <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                  ))}
                </TabList>
              </Flex>
            )}
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
        <Tabs<(typeof TABS)[number]['key']> disabled defaultValue="activity">
          {({TabList}) => (
            <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
              <TabList>
                {TABS.map(tab => (
                  <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                ))}
              </TabList>
            </Stack>
          )}
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
        <Tabs<(typeof TABS)[number]['key']> defaultValue="details">
          {({TabList}) => (
            <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
              <TabList>
                {TABS.map(tab => (
                  <TabList.Item key={tab.key} disabled={tab.key === 'user-feedback'}>
                    {tab.label}
                  </TabList.Item>
                ))}
              </TabList>
            </Stack>
          )}
        </Tabs>
      </Wrapper>
    ),
    {
      tags: {state: 'single-disabled', area: 'core'},
    }
  );
});
