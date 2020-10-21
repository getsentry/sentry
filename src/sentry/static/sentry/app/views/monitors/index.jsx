import {Component} from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import withGlobalSelection from 'app/utils/withGlobalSelection';

const Body = styled('div')`
  background-color: ${p => p.theme.gray100};
  flex-direction: column;
  flex: 1;
`;

class MonitorsContainer extends Component {
  render() {
    const {children} = this.props;

    return (
      <Feature features={['monitors']} renderDisabled>
        <GlobalSelectionHeader
          showEnvironmentSelector={false}
          showDateSelector={false}
          resetParamsOnChange={['cursor']}
        >
          <PageContent>
            <Body>{children}</Body>
          </PageContent>
        </GlobalSelectionHeader>
      </Feature>
    );
  }
}

export default withGlobalSelection(MonitorsContainer);
export {MonitorsContainer};
