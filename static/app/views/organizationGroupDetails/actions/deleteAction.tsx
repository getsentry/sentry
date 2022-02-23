import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import ActionButton from 'sentry/components/actions/button';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import {IconChevron, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';

type Props = {
  disabled: boolean;
  onDelete: () => void;
  onDiscard: () => void;
  organization: Organization;
  project: Project;
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
          <Fragment>
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
          </Fragment>
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
          title={t('Deletes the issue. A new issue will be created if it happens again.')}
          tooltipProps={{delay: 300}}
          aria-label={t('Delete issue')}
          icon={<IconDelete size="xs" />}
        />
      </Confirm>
      <DropdownMenuControlV2
        isDisabled={disabled}
        trigger={({props: triggerProps, ref: triggerRef}) => (
          <DropdownTrigger
            ref={triggerRef}
            {...triggerProps}
            aria-label={t('More delete options')}
            size="xsmall"
            icon={<IconChevron direction="down" size="xs" />}
            disabled={disabled}
          />
        )}
        menuTitle={t('Delete & Discard')}
        items={[
          {
            key: 'delete',
            label: t('Delete and discard future events'),
            onAction: () => openDiscardModal(),
          },
        ]}
      />
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

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

export default DeleteAction;
