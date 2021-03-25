import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Tag from 'app/components/tag';
import {IconGithub, IconGitlab} from 'app/icons';
import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = AsyncComponent['props'] & {
  theme: Theme;
  organization: Organization;
  project: Project;
};

type State = {} & AsyncComponent['state'];

class CodeOwners extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    return [
      [
        'codeowners',
        `/projects/${organization.slug}/${project.slug}/codeowners/?expand=codeMapping`,
      ],
    ];
  }
  renderIcon(provider) {
    switch (provider) {
      case 'github':
        return <IconGithub size="md" />;
      case 'gitlab':
        return <IconGitlab size="md" />;
      default:
        return null;
    }
  }
  renderView(data) {
    const {theme} = this.props;
    const {
      raw,
      dateUpdated,
      provider,
      codeMapping: {repoName},
    } = data;
    return (
      <Container>
        <RulesHeader>
          <TitleContainer>
            {this.renderIcon(provider)}
            <Title>CODEOWNERS</Title>
          </TitleContainer>
          <ReadOnlyTag type="default">{'Read Only'}</ReadOnlyTag>
          <Repository>{repoName}</Repository>
          <Detail />
        </RulesHeader>
        <RulesView>
          <InnerPanel>
            <InnerPanelHeader>{`Last synced ${moment(
              dateUpdated
            ).fromNow()}`}</InnerPanelHeader>
            <InnerPanelBody>
              <StyledTextArea
                // disabled={true}
                value={raw}
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                theme={theme}
              />
            </InnerPanelBody>
          </InnerPanel>
        </RulesView>
      </Container>
    );
  }

  renderBody() {
    const {codeowners} = this.state;
    return codeowners.map(codeowner => (
      <React.Fragment key={codeowner.id}>{this.renderView(codeowner)}</React.Fragment>
    ));
  }
}

export default withTheme(CodeOwners);

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  grid-template-areas: 'rules-header rules-view';
  height: 400px;
  margin-bottom: ${space(3)};
`;

const RulesHeader = styled('div')`
  grid-area: rules-header;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 45px 1fr 1fr 1fr 1fr;
  grid-template-areas: 'title tag' 'repository repository' '. .' '. .' 'detail detail';
  border: 1px solid #c6becf;
  border-radius: 4px 0 0 4px;
  border-right: none;
  box-shadow: 0 2px 0 rgb(37 11 54 / 4%);
  background-color: #ffffff;
`;
const TitleContainer = styled('div')`
  grid-area: title;
  align-self: center;
  padding-left: ${space(2)};
  display: flex;
  * {
    padding-right: ${space(0.5)};
  }
`;
const Title = styled('div')`
  align-self: center;
`;
const ReadOnlyTag = styled(Tag)`
  grid-area: tag;
  align-self: center;
  justify-self: end;
  padding-right: ${space(1)};
`;
const Repository = styled('div')`
  grid-area: repository;
  padding-left: calc(${space(2)} + ${space(3)});
  color: #9386a0;
  font-size: 14px;
`;
const Detail = styled('div')`
  grid-area: detail;
  align-self: end;
  padding: 0 0 ${space(2)} ${space(2)};
  color: #9386a0;
  font-size: 14px;
`;

const RulesView = styled('div')`
  grid-area: rules-view;
`;

const InnerPanel = styled(Panel)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0px;
  margin: 0px;
  height: 100%;
`;

const InnerPanelHeader = styled(PanelHeader)`
  text-transform: none;
`;
const InnerPanelBody = styled(PanelBody)`
  height: auto;
`;

const StyledTextArea = styled(TextareaAutosize)`
  ${inputStyles};
  height: calc(400px - ${space(2)} - ${space(1)} - ${space(3)}) !important;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 0;
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-all;
  white-space: pre-wrap;
  line-height: ${space(3)};
  border: none;
  box-shadow: none;
  padding: ${space(2)};

  &:hover,
  &:focus,
  &:active {
    border: none;
    box-shadow: none;
  }
`;
