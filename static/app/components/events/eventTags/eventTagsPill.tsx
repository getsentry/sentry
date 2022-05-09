import {css} from '@emotion/react';
import {Query} from 'history';
import * as qs from 'query-string';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import ExternalLink from 'sentry/components/links/externalLink';
import Pill from 'sentry/components/pill';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconOpen} from 'sentry/icons';
import {Organization} from 'sentry/types';
import {EventTag} from 'sentry/types/event';
import {isUrl} from 'sentry/utils';

import EventTagsPillValue from './eventTagsPillValue';

const iconStyle = css`
  position: relative;
  top: 1px;
`;

type Props = {
  organization: Organization;
  projectId: string;
  query: Query;
  streamPath: string;
  tag: EventTag;
};

const EventTagsPill = ({tag, query, organization, projectId, streamPath}: Props) => {
  const locationSearch = `?${qs.stringify(query)}`;
  const {key, value} = tag;
  const isRelease = key === 'release';
  const name = !key ? <AnnotatedText value={key} meta={getMeta(tag, 'key')} /> : key;
  const type = !key ? 'error' : undefined;

  return (
    <Pill name={name} value={value} type={type}>
      {isRelease ? (
        <VersionHoverCard
          organization={organization}
          projectSlug={projectId}
          releaseVersion={value}
          showUnderline
          underlineColor="linkUnderline"
        >
          <Version version={String(value)} truncate />
        </VersionHoverCard>
      ) : (
        <EventTagsPillValue
          tag={tag}
          meta={getMeta(tag, 'value')}
          streamPath={streamPath}
          locationSearch={locationSearch}
        />
      )}
      {isUrl(value) && (
        <ExternalLink href={value} className="external-icon">
          <IconOpen size="xs" css={iconStyle} />
        </ExternalLink>
      )}
    </Pill>
  );
};

export default EventTagsPill;
