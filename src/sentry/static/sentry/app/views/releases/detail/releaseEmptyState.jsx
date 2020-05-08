import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Button from 'app/components/button';
import Well from 'app/components/well';
import {IconCommit} from 'app/icons';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';

class ReleaseEmptyState extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };
  render() {
    return (
      <StyledWell centered>
        <IconCommit size="xl" />
        <h5>{t('Releases are better with commit data!')}</h5>
        <p>
          {t(`Connect a repository to see commit info, files changed, and authors
                  involved in future releases`)}
          .
        </p>
        <Button
          priority="primary"
          href={`/organizations/${this.props.organization.slug}/repos/`}
        >
          {t('Connect a repository')}
        </Button>
      </StyledWell>
    );
  }
}

const StyledWell = styled(Well)`
  margin-top: ${space(4)};
  padding-top: ${space(2)};
  padding-bottom: ${space(4)};
`;

export default withOrganization(ReleaseEmptyState);
