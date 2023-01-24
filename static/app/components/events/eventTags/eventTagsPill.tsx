import {css} from '@emotion/react';
import {Query} from 'history';
import * as qs from 'query-string';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
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
  projectSlug: string;
  query: Query;
  streamPath: string;
  tag: EventTag;
  meta?: Record<any, any>;
};

const EventTagsPill = ({
  tag,
  query,
  organization,
  projectSlug,
  streamPath,
  meta,
}: Props) => {
  const locationSearch = `?${qs.stringify(query)}`;
  const {key, value} = tag;
  const name = !key ? <AnnotatedText value={key} meta={meta?.key?.['']} /> : key;
  const type = !key ? 'error' : undefined;

  return (
    <Pill name={name} value={value} type={type}>
      {key === 'release' ? (
        <VersionHoverCard
          organization={organization}
          projectSlug={projectSlug}
          releaseVersion={value}
          showUnderline
          underlineColor="linkUnderline"
        >
          <Version version={String(value)} truncate />
        </VersionHoverCard>
      ) : (
        <EventTagsPillValue
          tag={tag}
          meta={meta?.value?.['']}
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
