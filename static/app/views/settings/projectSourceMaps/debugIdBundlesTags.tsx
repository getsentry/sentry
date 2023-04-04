import {Fragment} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import Tag from 'sentry/components/tag';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  dist?: string | null;
  loading?: boolean;
  release?: string | null;
};

export const DebugIdBundlesTags = ({dist, release, loading}: Props) => {
  return (
    <Tags>
      {loading ? (
        <Fragment>
          <StyledPlaceholder width="60px" height="20px" />
          <StyledPlaceholder width="40px" height="20px" />
        </Fragment>
      ) : (
        <Fragment>
          {dist && (
            <Tag
              tooltipText={tct('Associated with distribution "[distribution]"', {
                distribution: dist,
              })}
              type="info"
            >
              {dist}
            </Tag>
          )}
          {release && (
            <Tag
              tooltipText={tct('Associated with release "[releaseName]"', {
                releaseName: release,
              })}
              type="info"
            >
              {release}
            </Tag>
          )}
          {!dist && !release && (
            <Tag tooltipText={t('Not associated with a release or distribution')}>
              {t('none')}
            </Tag>
          )}
        </Fragment>
      )}
    </Tags>
  );
};

const Tags = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const StyledPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.background};
`;
