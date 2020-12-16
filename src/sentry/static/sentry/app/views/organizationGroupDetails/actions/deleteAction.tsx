import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
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
    <DeleteDiscardWrapper>
      <StyledLinkWithConfirmation
        className="group-remove btn btn-default btn-sm"
        title={t('Delete')}
        message={t(
          'Deleting this issue is permanent. Are you sure you wish to continue?'
        )}
        onConfirm={onDelete}
        disabled={disabled}
      >
        <IconWrapper>
          <IconDelete size="xs" />
        </IconWrapper>
      </StyledLinkWithConfirmation>
      <StyledDropdownLink
        title=""
        caret
        className="group-delete btn btn-default btn-sm"
        disabled={disabled}
      >
        <StyledMenuItemHeader header>{t('Delete & Discard')}</StyledMenuItemHeader>
        <StyledMenuItem onClick={openDiscardModal}>
          <span>{t('Delete and discard future events')}</span>
        </StyledMenuItem>
      </StyledDropdownLink>
    </DeleteDiscardWrapper>
  );
}

export default DeleteAction;

const dropdownTipCss = p => css`
  & ul {
    padding: 0;
    border-radius: ${p.theme.borderRadius};
    top: 40px;
    &:after {
      border-bottom: 8px solid ${p.theme.bodyBackground};
    }
  }
`;

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;

const StyledMenuItemHeader = styled(MenuItem)`
  text-transform: uppercase;
  padding: ${space(1)} 0 ${space(1)} 10px;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  background: ${p => p.theme.bodyBackground};
  border-bottom: 1px solid ${p => p.theme.border};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const StyledMenuItem = styled(MenuItem)`
  & span {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    padding: 5px;
  }
  & span:hover {
    background: ${p => p.theme.bodyBackground};
  }
`;

const StyledDropdownLink = styled(DropdownLink)`
  transition: none;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
`;

const StyledLinkWithConfirmation = styled(LinkWithConfirmation)`
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-right: 0;
`;

const DeleteDiscardWrapper = styled('div')`
  display: inline-block;
  margin-right: 5px;
  ${dropdownTipCss}
  & span {
    position: relative;
  }
`;
