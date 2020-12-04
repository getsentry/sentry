import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
<<<<<<< HEAD
=======
import ButtonBar from 'app/components/buttonBar';
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';

type Props = {
  organization: Organization;
  project: Project;
  onDelete: () => void;
  onDiscard: () => void;
<<<<<<< HEAD
  disabled: boolean;
};

function DeleteAction({disabled, project, organization, onDiscard, onDelete}: Props) {
=======
};

function DeleteAction({project, organization, onDiscard, onDelete}: Props) {
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
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
<<<<<<< HEAD
                renderDisabled({...props, hasFeature, children: null})}
=======
                renderDisabled({...props, hasFeature})}
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
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
<<<<<<< HEAD
    <div className="btn-group">
=======
    <ButtonBar className="btn-group">
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
      <LinkWithConfirmation
        className="group-remove btn btn-default btn-sm"
        title={t('Delete')}
        message={t(
          'Deleting this issue is permanent. Are you sure you wish to continue?'
        )}
        onConfirm={onDelete}
<<<<<<< HEAD
        disabled={disabled}
=======
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
      >
        <IconWrapper>
          <IconDelete size="xs" />
        </IconWrapper>
      </LinkWithConfirmation>
<<<<<<< HEAD
      <DropdownLink
        title=""
        caret
        className="group-delete btn btn-default btn-sm"
        disabled={disabled}
      >
=======
      <DropdownLink title="" caret className="group-delete btn btn-default btn-sm">
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
        <MenuItem onClick={openDiscardModal}>
          <span>{t('Delete and discard future events')}</span>
        </MenuItem>
      </DropdownLink>
<<<<<<< HEAD
    </div>
=======
    </ButtonBar>
>>>>>>> ref(ts): Convert organizationGroupDetails Actions to Typescript
  );
}

export default DeleteAction;

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;
