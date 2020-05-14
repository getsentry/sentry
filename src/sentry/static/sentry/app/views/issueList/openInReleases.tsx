import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';
import {IconReleases} from 'app/icons';

type Props = {
  query: string;
  orgSlug: string;
  location: Location;
};

const OpenInReleases = ({query, orgSlug, location}: Props) => {
  const {release, firstRelease, 'first-release': firstDashRelease} = tokenizeSearch(
    query
  );

  const getLastValue = (token: string[]) => {
    if (!token) {
      return undefined;
    }

    return token[token.length - 1];
  };

  const releaseVersion =
    getLastValue(release) ?? getLastValue(firstRelease) ?? getLastValue(firstDashRelease);

  if (!releaseVersion || releaseVersion === 'latest') {
    return null;
  }

  return (
    <StyledButton
      to={{
        pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
          releaseVersion
        )}/`,
        query: extractSelectionParameters(location.query),
      }}
      icon={<IconReleases size="sm" />}
    >
      {t('Open Release')}
    </StyledButton>
  );
};

const StyledButton = styled(Button)`
  margin-right: ${space(0.5)};
  white-space: nowrap;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

export default OpenInReleases;
