import {MemoryRouter} from 'react-router';

import {BreadcrumbList, type BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface ExampleBreadcrumbsProps extends BreadcrumbListProps {
  title?: React.ReactNode;
}

function ExampleBreadcrumbs({items, title}: ExampleBreadcrumbsProps) {
  return (
    <MemoryRouter>
      <Text as="div">
        <Container padding="md">
          <Flex
            containerType="inline-size"
            width="100%"
            align="center"
            gap="sm"
            minWidth={0}
          >
            <Flex align="center" minWidth={0} flex="0 1 auto">
              <BreadcrumbList items={items} />
            </Flex>
            <Container flex="1" minWidth={0}>
              {title ?? (
                <BreadcrumbList.Title
                  item={{
                    type: 'page-title',
                    label: 'Authentication settings for the current organization',
                  }}
                />
              )}
            </Container>
          </Flex>
        </Container>
      </Text>
    </MemoryRouter>
  );
}

describe('BreadcrumbList', () => {
  describe.each([480, 560, 900])('container width %s', viewport => {
    it.snapshot(
      'long labels',
      () => (
        <ExampleBreadcrumbs
          items={[
            {type: 'link', label: 'Organization settings', to: '/settings/'},
            {type: 'link', label: 'Security', to: '/settings/security/'},
          ]}
        />
      ),
      {viewport, tags: {area: 'core', parents: 'links'}}
    );

    it.snapshot(
      'current item',
      () => (
        <ExampleBreadcrumbs
          items={[{type: 'link', label: 'All Tags', to: '/tags/'}]}
          title={
            <BreadcrumbList.Current
              item={{label: 'browser.name', labelTooltip: 'Event ID: 1a2b3c4d'}}
            />
          }
        />
      ),
      {viewport, tags: {area: 'core', parents: 'links'}}
    );

    it.snapshot(
      'select parent',
      () => (
        <ExampleBreadcrumbs
          items={[
            {type: 'link', label: 'Settings', to: '/settings/'},
            {
              type: 'select',
              value: 'javascript',
              options: [
                {value: 'javascript', label: 'JavaScript project'},
                {value: 'python', label: 'Python project'},
              ],
              onChange: () => {},
            },
          ]}
        />
      ),
      {viewport, tags: {area: 'core', parents: 'select'}}
    );
  });
});
