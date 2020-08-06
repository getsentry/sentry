import React from 'react';
import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import {Team, Organization} from 'app/types';
import AvatarChooser from 'app/components/avatarChooser';
import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';

type Props = {
  team: Team;
  canWrite: boolean;
  orgSlug: Organization['slug'];
} & ModalRenderProps;

type State = {
  isSaving: boolean;
};
class ModalEditAvatar extends React.Component<Props, State> {
  state: State = {
    isSaving: false,
  };

  render() {
    const {canWrite, team, orgSlug, Header, Body, Footer, closeModal} = this.props;
    const {isSaving} = this.state;

    return (
      <React.Fragment>
        <Header closeButton>
          <span>{t("Edit Team's %s Avatar", capitalize(team.slug))}</span>
        </Header>
        <Body>
          <AvatarChooser
            type="team"
            allowGravatar={false}
            endpoint={`/teams/${orgSlug}/${team.slug}/avatar`}
            model={team}
            isSaving={isSaving}
            onSave={() => this.setState({isSaving: false})}
            disabled={!canWrite}
            withoutPanels
          />
        </Body>
        <Footer>
          <ButtonBar gap={1.5}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              disabled={!canWrite}
              onClick={() => this.setState({isSaving: true})}
              priority="primary"
            >
              {t('Save Avatar')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default ModalEditAvatar;
