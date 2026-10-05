import {type CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

import {useActionableItemsWithProguardErrors} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopyId, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {Divider} from 'sentry/views/issueDetails/divider';
import {EventCreatedTooltip} from 'sentry/views/issueDetails/eventCreatedTooltip';
import {IssueDetailsJumpTo} from 'sentry/views/issueDetails/eventNavigation/issueDetailsJumpTo';
import {getFoldSectionKey} from 'sentry/views/issueDetails/foldSection';

type EventNavigationProps = {
  event: Event;
  group: Group;
  className?: string;
  /**
   * Data property to help style the component when it's sticky
   */
  'data-stuck'?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  style?: CSSProperties;
};

export const MIN_NAV_HEIGHT = 44;

export function EventTitle({event, group, ref, ...props}: EventNavigationProps) {
  const organization = useOrganization();

  const [_isEventErrorCollapsed, setEventErrorCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.PROCESSING_ERROR),
    true
  );

  const actionableItems = useActionableItemsWithProguardErrors({
    event,
    project: group.project,
    isShare: false,
  });

  const host = organization.links.regionUrl;
  const jsonUrl = `${host}/api/0/projects/${organization.slug}/${group.project.slug}/events/${event.id}/json/`;

  const {copy} = useCopyToClipboard();

  const handleCopyEventId = () => {
    copy(event.id, {successMessage: t('Event ID copied to clipboard')}).then(() => {
      trackAnalytics('issue_details.copy_event_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
        streamline: true,
      });
    });
  };

  return (
    <div {...props} ref={ref}>
      <Grid
        columns={
          actionableItems
            ? {zero: '1fr', '4xl': '1fr auto'}
            : {zero: '1fr', xl: '1fr auto'}
        }
        gap={actionableItems ? {zero: 'xs', '4xl': 'md'} : {zero: 'xs', xl: 'md'}}
        align="center"
        padding={
          actionableItems ? {zero: 'xs xl', '4xl': '0 lg'} : {zero: 'xs xl', xl: '0 lg'}
        }
        minHeight={`${MIN_NAV_HEIGHT}px`}
      >
        <Text density="default" variant="inherit">
          {textProps => (
            <Flex
              {...textProps}
              align="center"
              direction="row"
              gap="sm"
              paddingTop={{zero: 'md', xl: '0'}}
            >
              <RevealOnHover gap="2xs" align="center">
                <Text bold wrap="nowrap" onClick={handleCopyEventId}>
                  {t('ID: %s', getShortEventId(event.id))}
                </Text>
                <RevealOnHover.Action>
                  <Button
                    aria-label={t('Copy Event ID')}
                    tooltipProps={{title: t('Copy Event ID')}}
                    onClick={handleCopyEventId}
                    size="zero"
                    variant="transparent"
                    icon={<IconCopyId size="xs" variant="muted" />}
                  />
                </RevealOnHover.Action>
              </RevealOnHover>
              <Text variant="muted" wrap="nowrap">
                {timeTextProps => (
                  <TimeSince
                    {...timeTextProps}
                    tooltipBody={<EventCreatedTooltip event={event} />}
                    maxWidth={300}
                    date={event.dateCreated ?? event.dateReceived}
                    aria-label={t('Event timestamp')}
                  />
                )}
              </Text>
              <Flex align="center" gap="xs" className="hidden-xs">
                <Divider />
                <JsonLink
                  href={jsonUrl}
                  onClick={() =>
                    trackAnalytics('issue_details.event_json_clicked', {
                      organization,
                      group_id: parseInt(`${event.groupID}`, 10),
                      streamline: true,
                    })
                  }
                >
                  {t('JSON')}
                </JsonLink>
              </Flex>
              {actionableItems && actionableItems.length > 0 && (
                <Fragment>
                  <Divider />
                  <ProcessingErrorButton
                    tooltipProps={{
                      title: t(
                        'Sentry has detected configuration issues with this event. Click for more info.'
                      ),
                    }}
                    variant="transparent"
                    size="zero"
                    icon={<IconWarning variant="danger" />}
                    onClick={() => {
                      document
                        .getElementById(SectionKey.PROCESSING_ERROR)
                        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
                      setEventErrorCollapsed(false);
                    }}
                  >
                    {t('Processing Error')}
                  </ProcessingErrorButton>
                </Fragment>
              )}
            </Flex>
          )}
        </Text>
        <IssueDetailsJumpTo />
      </Grid>
    </div>
  );
}

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.colors.red400};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.sm};
  :hover {
    color: ${p => p.theme.colors.red400};
  }
`;

const JsonLink = styled(ExternalLink)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;
  text-decoration-color: ${p => color(p.theme.colors.gray400).alpha(0.5).string()};

  :hover {
    color: ${p => p.theme.tokens.content.secondary};
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.tokens.content.secondary};
  }
`;
