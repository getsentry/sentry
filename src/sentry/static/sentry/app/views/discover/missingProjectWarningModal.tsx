import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {Organization} from 'app/types';

type MissingProjectWarningModalProps = ModalRenderProps & {
  organization: Organization;
  validProjects: number[];
  invalidProjects: number[];
};

export default class MissingProjectWarningModal extends React.Component<
  MissingProjectWarningModalProps
> {
  renderProject(id: number) {
    const project = this.props.organization.projects.find(p => p.id === id.toString());
    return <li key={id}>{project ? project.slug : t(`Unknown project ${id}`)}</li>;
  }
  render() {
    const {Header, Body, Footer, validProjects, invalidProjects} = this.props;

    const text = validProjects.length
      ? t(`You are not currently a member of all of the projects specified by
          this query. As a result, data for the following projects will be
          omitted from the displayed results:`)
      : t(`You are not currently a member of any of the following projects specified
           by this query. You may still run this query against other projects you
           have access to.`);

    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
}
