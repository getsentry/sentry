import {Button} from '@sentry/scraps/button';
import {CompactSelectControl, MenuComponents} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {IssueListSortOptions} from 'sentry/views/issueList/actions/sortOptions';
import {
  ISSUE_DISPLAY_PROPERTIES,
  useIssueDisplayProperties,
} from 'sentry/views/issueList/displayProperties';
import {IssueFilterMenu} from 'sentry/views/issueList/filterMenu';
import {IssueSearch} from 'sentry/views/issueList/issueSearch';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import {getSortLabel, type IssueSortOptions} from 'sentry/views/issueList/utils';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

export function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  const {columns, toggleColumn, resetColumns} = useIssueDisplayProperties();

  return (
    <Flex align="start" gap="md" wrap="wrap" paddingBottom="xl" width="100%">
      <Container flex="1" minWidth="240px">
        <IssueSearch query={query} onSearch={onSearch} />
      </Container>
      <Flex gap="sm" align="center">
        <Text size="xs" variant="muted">
          {t('Ordered by %s', getSortLabel(sort))}
        </Text>
        <IssueFilterMenu query={query} onSearch={onSearch} />
        <CompactSelectControl
          menuTitle={t('Display Options')}
          menuWidth={320}
          position="bottom-end"
          menuBody={
            <Stack>
              <Flex
                padding="lg"
                align="center"
                justify="between"
                gap="md"
                borderBottom="primary"
              >
                <Text size="sm">{t('Order by')}</Text>
                <IssueListSortOptions
                  query={query}
                  sort={sort}
                  onSelect={onSortChange}
                  triggerSize="sm"
                  showIcon={false}
                />
              </Flex>
              <Stack padding="lg" gap="md">
                <Text size="sm" variant="muted">
                  {t('Display properties')}
                </Text>
                <Flex
                  gap="sm"
                  wrap="wrap"
                  role="group"
                  aria-label={t('Display properties')}
                >
                  {ISSUE_DISPLAY_PROPERTIES.map(property => (
                    <Button
                      key={property.value}
                      size="xs"
                      variant={columns.includes(property.value) ? 'primary' : 'secondary'}
                      aria-pressed={columns.includes(property.value)}
                      onClick={() => toggleColumn(property.value)}
                      style={{borderRadius: 9999}}
                    >
                      {property.label}
                    </Button>
                  ))}
                </Flex>
                <Text size="xs" variant="muted">
                  {t('Saved on this browser. Properties adapt to available space.')}
                </Text>
              </Stack>
            </Stack>
          }
          menuFooter={
            <MenuComponents.CTAButton onClick={resetColumns}>
              {t('Reset display properties')}
            </MenuComponents.CTAButton>
          }
          trigger={props => (
            <OverlayTrigger.IconButton
              {...props}
              variant="transparent"
              aria-label={t('Display Options')}
              icon={<IconSliders />}
            />
          )}
        />
        <IssueViewSaveButton query={query} sort={sort} />
      </Flex>
    </Flex>
  );
}
