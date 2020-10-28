import React from 'react';
import {withInfo} from '@storybook/addon-info';

import AlertLink from 'app/components/alertLink';
import {IconDocs, IconGeneric, IconMail, IconStack, IconStar} from 'app/icons';

export default {
  title: 'Core/Alerts/AlertLink',
};

export const Default = withInfo(
  'A way to loudly link between different parts of the application'
)(() => [
  <AlertLink to="/settings/account/notifications" key="1">
    Check out the notifications settings panel.
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="error" key="2">
    Do not forget to read the docs ya dum dum!
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="info" key="3">
    Install this thing or else!
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="success" key="4">
    Gj you did it. Now go here.
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="muted" key="5">
    I am saying nothing, ok?
  </AlertLink>,
]);

Default.story = {
  name: 'default',
};

export const WithAnIcon = withInfo('You can optionally pass an icon src')(() => [
  <AlertLink to="/settings/account/notifications" icon={<IconMail />} key="1">
    Gumbo beet greens corn soko endive gumbo gourd. Parsley shallot courgette tatsoi pea
    sprouts fava bean collard greens dandelion okra wakame tomato. Dandelion cucumber
    earthnut pea peanut soko zucchini.
  </AlertLink>,
  <AlertLink
    to="/settings/account/notifications"
    icon={<IconDocs />}
    priority="error"
    key="2"
  >
    Do not forget to read the docs ya dum dum!
  </AlertLink>,
  <AlertLink
    to="/settings/account/notifications"
    icon={<IconStack />}
    priority="info"
    key="3"
  >
    Install this thing or else!
  </AlertLink>,
  <AlertLink
    to="/settings/account/notifications"
    icon={<IconStar />}
    priority="success"
    key="4"
  >
    Gj you did it. Now go here.
  </AlertLink>,
  <AlertLink
    to="/settings/account/notifications"
    icon={<IconGeneric />}
    priority="muted"
    key="5"
  >
    I am saying nothing, ok?
  </AlertLink>,
]);

WithAnIcon.story = {
  name: 'with an icon',
};

export const Small = withInfo('You can optionally pass an icon src')(() => [
  <AlertLink to="/settings/account/notifications" size="small" key="1">
    Check out the notifications settings panel.
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="error" size="small" key="2">
    Do not forget to read the docs ya dum dum!
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="info" size="small" key="3">
    Install this thing or else!
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="success" size="small" key="4">
    Gj you did it. Now go here.
  </AlertLink>,
  <AlertLink to="/settings/account/notifications" priority="muted" size="small" key="5">
    I am saying nothing, ok?
  </AlertLink>,
]);

Small.story = {
  name: 'small',
};
