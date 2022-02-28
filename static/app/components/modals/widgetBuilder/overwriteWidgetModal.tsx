import {css} from '@emotion/react';

import {closeModal, ModalRenderProps} from 'sentry/actionCreators/modal';
import {Card} from 'sentry/views/dashboardsV2/widgetBuilder/widgetLibrary/card';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

export type OverwriteWidgetModalProps = {
  iconColor: string;
  onConfirm: () => void;
  widget: WidgetTemplate;
};

type Props = ModalRenderProps & OverwriteWidgetModalProps;

export default function OverwriteWidgetModal({onConfirm, widget, iconColor}: Props) {
  return (
    <div>
      <div>Overwrite Widget</div>
      <div>
        You've already started building this widget. Are you sure you want to overwrite
        this widget with the template values?
      </div>
      <Card widget={widget} iconColor={iconColor} disableHoverAnimation />
      <footer>
        <button onClick={closeModal}>Cancel</button>
        <button
          onClick={() => {
            onConfirm();
            closeModal();
          }}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;
