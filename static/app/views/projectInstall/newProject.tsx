import styled from '@emotion/styled';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import CreateProject from 'sentry/views/projectInstall/createProject';

const NewProject = () => (
  <SentryDocumentTitle>
    <Container>
      <div className="container">
        <Content>
          <CreateProject />
        </Content>
      </div>
    </Container>
  </SentryDocumentTitle>
);

const Container = styled('div')`
  flex: 1;
  background: ${p => p.theme.background};
`;

const Content = styled('div')`
  margin-top: ${space(3)};
`;

export default NewProject;
