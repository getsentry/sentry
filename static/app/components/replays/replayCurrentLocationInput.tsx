import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Flex} from '@sentry/scraps/layout/flex';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import getCurrentScreenName from 'sentry/utils/replays/getCurrentScreenName';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

export default function ReplayCurrentLocationInput() {
  const organization = useOrganization();
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();

  const projId = replay?.getReplay()?.project_id;
  const project = useProjectFromId({project_id: projId});
  const projectSlug = project?.slug;

  const currentLocation = getCurrentLocation(replay, currentTime);

  const scrubbingTooltip = currentLocation?.includes('[Filtered]')
    ? tct(
        "Funny looking URL? It contains content scrubbed by our [filters:Data Scrubber] and may no longer be valid. This is to protect your users' privacy. If necessary, you can turn this off in your [settings:Settings, under Security & Privacy].",
        {
          filters: (
            <ExternalLink href="https://docs.sentry.io/product/data-management-settings/scrubbing/server-side-scrubbing/" />
          ),
          settings: projectSlug ? (
            <Link
              to={normalizeUrl(
                `/settings/${organization.slug}/projects/${projectSlug}/security-and-privacy/`
              )}
            />
          ) : (
            <Fragment />
          ),
        }
      )
    : undefined;

  const flutterWarning = replay?.getReplay()?.sdk.name?.includes('flutter') ? (
    <QuestionTooltip
      isHoverable
      title={tct(
        'In order to see the correct screen name, you need to configure the [link:Sentry Routing Instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/integrations/routing-instrumentation/" />
          ),
        }
      )}
      size="md"
    />
  ) : null;

  return (
    <Flex gap="sm" flex="1" align="center">
      <Tooltip title={scrubbingTooltip} disabled={!scrubbingTooltip} skipWrapper>
        <FlexTextCopyInput aria-label={t('Current Location')} size="sm">
          {currentLocation}
        </FlexTextCopyInput>
      </Tooltip>
      {flutterWarning}
    </Flex>
  );
}

function getCurrentLocation(replay: null | ReplayReader, currentTime: number) {
  try {
    return replay?.isVideoReplay()
      ? getCurrentScreenName(
          replay?.getReplay(),
          replay?.getMobileNavigationFrames(),
          currentTime
        )
      : getCurrentUrl(replay?.getReplay(), replay?.getNavigationFrames(), currentTime);
  } catch (error) {
    Sentry.captureException(error);
    return '';
  }
}

const FlexTextCopyInput = styled(TextCopyInput)`
  flex: 1;
`;
