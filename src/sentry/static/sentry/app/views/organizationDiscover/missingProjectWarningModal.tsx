import React from 'react';
import Modal, {Header, Body, Footer} from 'react-bootstrap/lib/Modal';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {Organization} from './types';

type MissingProjectWarningModalProps = {
  organization: Organization;
  validProjects: number[];
  invalidProjects: number[];
  closeModal: () => void;
};

// TODO: any
const HeaderAny = Header as any;
const BodyAny = Body as any;
const FooterAny = Footer as any;

export default class MissingProjectWarningModal extends React.Component<
  MissingProjectWarningModalProps
> {
  renderProject(id: number) {
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
      <Modal show={true} onHide={() => {}}>
        <HeaderAny>{t('Project access')}</HeaderAny>
        <BodyAny>
          <p>{text}</p>
          <ul>{invalidProjects.map(id => this.renderProject(id))}</ul>
        </BodyAny>
        <FooterAny>
          <Button priority="primary" onClick={this.props.closeModal}>
            {t('View results')}
          </Button>
        </FooterAny>
      </Modal>
    );
  }
}
