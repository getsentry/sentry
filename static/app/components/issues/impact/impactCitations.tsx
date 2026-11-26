import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {Group, ImpactAssessment} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ImpactCitations({
  impact,
  group,
}: {
  group: Group;
  impact: ImpactAssessment;
}) {
  const organization = useOrganization();
  const {citations, sourceEventId} = impact;
  const eventUrl = `/organizations/${organization.slug}/issues/${group.id}/events/${sourceEventId}/`;

  return (
    <Flex gap="xs" wrap="wrap">
      <Container>
        <Text bold size="xs">
          {t('Citations:')}
        </Text>
      </Container>
      {citations.map((citation, index) => (
        <Tooltip
          key={`${citation.source}:${citation.reference}:${index}`}
          title={
            <Fragment>
              <Tooltip.Header
                trailingItems={
                  <Link to={eventUrl}>{getShortEventId(sourceEventId)}</Link>
                }
              >
                <Text size="sm">{t('Source Event')}</Text>
              </Tooltip.Header>
              <Text size="sm" align="left">
                {citation.claim}
              </Text>
            </Fragment>
          }
        >
          <Tag variant="muted">{citation.source}</Tag>
        </Tooltip>
      ))}
    </Flex>
  );
}
