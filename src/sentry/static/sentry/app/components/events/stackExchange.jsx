import React from 'react';
import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Count from 'app/components/count';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

class EventStackExchange extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  state = {
    questions: [],
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    // TODO: track loading state
    this.fetchData();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchData = () => {
    console.log('props', this.props);

    const {api, project, organization, event} = this.props;

    api.request(
      `/projects/${organization.slug}/${project.slug}/events/${event.id}/stackexchange/`,
      {
        success: data => {
          console.log('response', data.items);

          if (!this._isMounted) {
            return;
          }

          this.setState({
            questions: data.items,
          });
        },
        error: err => {
          // TODO: refactor this
          console.log('oh crap its broken');
          console.log(err);
        },
      }
    );
  };

  renderHeaders() {
    return (
      <Sticky>
        <StyledFlex py={1}>
          <Box w={16} mx={1} />
          <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
            <ToolbarHeader>{t('Title')}</ToolbarHeader>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Answers')}</ToolbarHeader>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Views')}</ToolbarHeader>
          </Box>
        </StyledFlex>
      </Sticky>
    );
  }

  renderStackExchangeQuestion(question) {
    return (
      <Group key={question.question_id} py={1} px={0} align="center">
        <Box w={16} mx={1}>
          <div>{question.is_answered && <span className="icon-checkmark" />}</div>
        </Box>
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
          <div>{question.title}</div>
          <Pills className="no-margin">
            {question.tags.map(tag => (
              <Pill key={tag} name={tag} />
            ))}
          </Pills>
        </Box>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.answer_count} />
        </Flex>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.view_count} />
        </Flex>
      </Group>
    );
  }

  render() {
    return (
      <div className="extra-data box">
        <div className="box-header">
          <h3>StackExchange</h3>
          <Panel>
            {this.renderHeaders()}
            <PanelBody>
              {this.state.questions.slice(0, 3).map(this.renderStackExchangeQuestion)}
            </PanelBody>
          </Panel>
        </div>
      </div>
    );
  }
}

const Group = styled(PanelItem)`
  line-height: 1.1;
`;

const Sticky = styled('div')`
  position: sticky;
  z-index: ${p => p.theme.zIndex.header};
  top: -1px;
`;

const StyledFlex = styled(Flex)`
  align-items: center;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const StyledCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray3};
`;

export default withApi(EventStackExchange);
