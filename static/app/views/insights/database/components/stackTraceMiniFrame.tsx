import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyFrameLink} from 'sentry/components/events/interfaces/frame/copyFrameLink';
import {useStacktraceLink} from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon, getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {MODULE_DOC_LINK} from 'sentry/views/insights/database/settings';

const DEFAULT_ICON_SIZE = 'xs';
const DEFAULT_BUTTON_SIZE = 'xs';

interface Props {
  event: Parameters<typeof useStacktraceLink>[0]['event'] | undefined;
  frame: Parameters<typeof useStacktraceLink>[0]['frame'];
  projectId: string | undefined;
}

export function StackTraceMiniFrame({frame, event, projectId}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);

  return (
    <Flex
      align="center"
      background="secondary"
      borderTop="secondary"
      gap="xs"
      justify="between"
      padding="md lg"
    >
      <Flex as="span" align="center" flex="1 1 0" gap="xs" minWidth={0} wrap="wrap">
        {frame.filename && <Text>{frame.filename}</Text>}
        {frame.function && (
          <Fragment>
            <Text variant="muted"> {t('in')} </Text>
            <Text>{frame.function}</Text>
          </Fragment>
        )}
        {frame.lineNo && (
          <Fragment>
            <Text variant="muted"> {t('at line')} </Text>
            <Text>{frame.lineNo}</Text>
          </Fragment>
        )}
      </Flex>

      {frame.filename && (
        <Flex as="span" align="center" flexShrink={0} gap="sm">
          <CopyFrameLink frame={frame} />
          {event && project ? (
            <SourceCodeIntegrationLink event={event} project={project} frame={frame} />
          ) : null}
        </Flex>
      )}
    </Flex>
  );
}

type MissingFrameProps = {
  source?: 'dateRange' | 'span';
  system?: string;
};

export function MissingFrame({source = 'dateRange', system}: MissingFrameProps) {
  const documentation = <ExternalLink href={`${MODULE_DOC_LINK}#query-sources`} />;

  const errorMessage =
    system === 'mongodb'
      ? tct(
          'Query sources are not currently supported for MongoDB queries. Learn more in our [documentation:documentation].',
          {documentation}
        )
      : source === 'span'
        ? tct(
            'Query source is not available for this span. Learn more in our [documentation:documentation].',
            {documentation}
          )
        : tct(
            'Could not find query source in the selected date range. Learn more in our [documentation:documentation].',
            {documentation}
          );

  return (
    <Flex background="secondary" borderTop="secondary" padding="md lg">
      <Text variant="muted">{errorMessage}</Text>
    </Flex>
  );
}

interface SourceCodeIntegrationLinkProps {
  event: Parameters<typeof useStacktraceLink>[0]['event'];
  frame: Parameters<typeof useStacktraceLink>[0]['frame'];
  project: Project;
}
function SourceCodeIntegrationLink({
  event,
  project,
  frame,
}: SourceCodeIntegrationLinkProps) {
  const organization = useOrganization();

  const {data: match, isPending} = useStacktraceLink({
    event,
    frame,
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (match?.config && match.sourceUrl && frame.lineNo && !isPending) {
    const label = t('Open this line in %s', match.config.provider.name);

    return (
      <Tooltip title={label} skipWrapper>
        <LinkButton
          size={DEFAULT_BUTTON_SIZE}
          variant="transparent"
          external
          href={getIntegrationSourceUrl(
            match.config.provider.key,
            match.sourceUrl,
            frame.lineNo
          )}
          aria-label={label}
          icon={getIntegrationIcon(match.config.provider.key, DEFAULT_ICON_SIZE)}
        />
      </Tooltip>
    );
  }

  return null;
}
