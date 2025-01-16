import {useCallback} from 'react';
import type {Query} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(ContextPickerModal, story => {
  story('needProject=true', () => {
    const handleOpenModal = useCallback(() => {
      openModal(
        modalProps => (
          <ContextPickerModal
            {...modalProps}
            needOrg
            needProject={false}
            nextPath={''}
            onFinish={(
              _path: string | {pathname: string; query?: Query}
            ): number | void => {
              // throw new Error('Function not implemented.');
            }} // {...this.props}
          />
        ),
        {
          onClose() {
            // The modal is closed!
          },
        }
      );
    }, []);
    return <Button onClick={handleOpenModal}>Open the modal</Button>;
  });

  story('needProject=true', () => {
    const handleOpenModal = useCallback(() => {
      openModal(
        modalProps => (
          <ContextPickerModal
            {...modalProps}
            needOrg={false}
            needProject
            nextPath={''}
            onFinish={(
              _path: string | {pathname: string; query?: Query}
            ): number | void => {
              // throw new Error('Function not implemented.');
            }} // {...this.props}
          />
        ),
        {
          onClose() {
            // The modal is closed!
          },
        }
      );
    }, []);
    return <Button onClick={handleOpenModal}>Open the modal</Button>;
  });
});
