import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {escape} from 'sentry/utils';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

export function useReleaseMarkLineSeries({
  group,
  releases,
  onReleaseClick,
}: {
  group: Group;
  releases: ReleaseMetaBasic[];
  onReleaseClick?: (release: ReleaseMetaBasic) => void;
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const eventView = useIssueDetailsEventView({group});
  const organization = useOrganization();

  if (!releases.length) {
    return null;
  }

  const markLine = MarkLine({
    animation: false,
    lineStyle: {
      color: theme.colors.blue400,
      opacity: 0.3,
      type: 'solid',
    },
    label: {
      show: false,
    },
    data: releases.map(release => ({
      xAxis: +new Date(release.date),
      name: formatVersion(release.version, true),
      value: formatVersion(release.version, true),
      onClick: () => {
        if (onReleaseClick) {
          onReleaseClick(release);
          return;
        }
        navigate(
          makeReleasesPathname({
            organization,
            path: `/${encodeURIComponent(release.version)}/`,
          })
        );
      },
      label: {
        formatter: () => formatVersion(release.version, true),
      },
    })),
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(
          data.value,
          getFormat({timeZone: true, year: true}),
          {
            local: !eventView.utc,
          }
        );
        const version = escape(formatVersion(data.name, true));
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Release'
          )}</strong></span> ${version}</div>`,
          '</div>',
          '<div class="tooltip-footer">',
          time,
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    },
  });

  return {
    id: 'release-lines',
    seriesName: t('Releases'),
    data: [],
    markLine,
    color: theme.colors.blue500,
    type: 'line',
  };
}
