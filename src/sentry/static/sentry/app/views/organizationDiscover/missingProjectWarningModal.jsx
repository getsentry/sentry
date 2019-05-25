import React from 'react';
import PropTypes from 'prop-types';
import Modal, {Header, Body, Footer} from 'react-bootstrap/lib/Modal';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';

export default class MissingProjectWarningModal extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    validProjects: PropTypes.arrayOf(PropTypes.number).isRequired,
    invalidProjects: PropTypes.arrayOf(PropTypes.number).isRequired,
    closeModal: PropTypes.func,
  };

  renderProject(id) {
    const project = this.props.organization.projects.find(p => p.id === id.toString());
    return <li key={id}>{project ? project.slug : t(`Unknown project ${id}`)}</li>;
  }
  render() {
    const {validProjects, invalidProjects} = this.props;

    const text = validProjects.length
      ? t(`You are not currently a member of all of the projects specified by
          this query. As a result, data for the following projects will be
          omitted from the displayed results:`)
      : t(`You are not currently a member of any of the following projects specified
           by this query. You may still run this query against other projects you
           have access to.`);

    return (
      <Modal show={true}>
        <Header>{t('Project access')}</Header>
        <Body>
          <p>{text}</p>
          <ul>{invalidProjects.map(id => this.renderProject(id))}</ul>
        </Body>
        <Footer>
          <Button priority="primary" onClick={this.props.closeModal}>
            {t('View results')}
          </Button>
        </Footer>
      </Modal>
    );
  }
}
