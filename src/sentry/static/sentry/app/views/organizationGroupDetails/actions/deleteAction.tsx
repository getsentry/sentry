import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import ActionButton from 'app/components/actions/button';
import MenuHeader from 'app/components/actions/menuHeader';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import {IconChevron, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';

type Props = {
  organization: Organization;
  project: Project;
  onDelete: () => void;
  onDiscard: () => void;
  disabled: boolean;
};

function DeleteAction({disabled, project, organization, onDiscard, onDelete}: Props) {
  function renderDiscardDisabled({children, ...props}) {
    return children({
      ...props,
      renderDisabled: ({features}: {features: string[]}) => (
        <FeatureDisabled alert featureName="Discard and Delete" features={features} />
      ),
    });
  }

  function renderDiscardModal({Body, Footer, closeModal}: ModalRenderProps) {
    return (
      <Feature
        features={['projects:discard-groups']}
        hookName="feature-disabled:discard-groups"
        organization={organization}
        project={project}
        renderDisabled={renderDiscardDisabled}
      >
        {({hasFeature, renderDisabled, ...props}) => (
          <React.Fragment>
            <Body>
              {!hasFeature &&
                typeof renderDisabled === 'function' &&
                renderDisabled({...props, hasFeature, children: null})}
              {t(
                `Discarding this event will result in the deletion of most data associated with this issue and future events being discarded before reaching your stream. Are you sure you wish to continue?`
              )}
            </Body>
            <Footer>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              <Button
                style={{marginLeft: space(1)}}
                priority="primary"
                onClick={onDiscard}
                disabled={!hasFeature}
              >
                {t('Discard Future Events')}
              </Button>
            </Footer>
          </React.Fragment>
        )}
      </Feature>
    );
  }

  function openDiscardModal() {
    openModal(renderDiscardModal);
    analytics('feature.discard_group.modal_opened', {
      org_id: parseInt(organization.id, 10),
    });
  }

  return (
    <ButtonBar merged>
      <Confirm
        message={t(
          'Deleting this issue is permanent. Are you sure you wish to continue?'
        )}
        onConfirm={onDelete}
        disabled={disabled}
      >
        <DeleteButton
          disabled={disabled}
          label={t('Delete issue')}
          icon={<IconDelete size="xs" />}
        />
      </Confirm>
      <DropdownLink
        caret={false}
        disabled={disabled}
        customTitle={
          <ActionButton
            disabled={disabled}
            label={t('More delete options')}
            icon={<IconChevron direction="down" size="xs" />}
          />
        }
      >
        <MenuHeader>{t('Delete & Discard')}</MenuHeader>
        <MenuItemActionLink title="" onAction={openDiscardModal}>
          {t('Delete and discard future events')}
        </MenuItemActionLink>
      </DropdownLink>
    </ButtonBar>
  );
}

const DeleteButton = styled(ActionButton)`
  ${p =>
    !p.disabled &&
    `
  &:hover {
    background-color: ${p.theme.button.danger.background};
    color: ${p.theme.button.danger.color};
    border-color: ${p.theme.button.danger.border};
  }
  `}
`;

export default DeleteAction;
