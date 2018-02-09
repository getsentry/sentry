// Before submitting, form model will call `getData` if defined on a form field definition
// It is expecting the `data` object to send to API endpoint.
// For passwords, we need to send both password and verify password
// (regardless of the fact that there is client side validation for this)
const getPasswordData = (currentData, {id, form}) => {
  let otherPasswordKey = id === 'password' ? 'passwordVerify' : 'password';

  // This is only called after it passes validation, so assume passwords match
  // Send both `password` and `passwordVerify` fields
  return {
    ...currentData,
    [otherPasswordKey]: form[otherPasswordKey],
  };
};

const getUserIsNotManaged = ({user}) => !user.isManaged;

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Password',
    fields: [
      {
        name: 'password',
        type: 'secret',

        autoComplete: 'current-password',
        label: 'Current Password',
        placeholder: '',
        help: 'Your current password',
        visible: getUserIsNotManaged,
        required: true,
        getData: getPasswordData,
      },
      {
        name: 'passwordNew',
        type: 'secret',

        autoComplete: 'new-password',
        label: 'New Password',
        placeholder: '',
        help: '',
        required: true,
        visible: getUserIsNotManaged,
        validate: ({id, form}) => {
          if (form[id] !== form.passwordVerify) {
            return [[id]];
          }

          return [];
        },
        getData: getPasswordData,
      },
      {
        name: 'passwordVerify',
        type: 'secret',

        autoComplete: 'new-password',
        label: 'Verify New Password',
        placeholder: '',
        help: 'Verify your new password',
        required: true,
        visible: getUserIsNotManaged,
        validate: ({id, form}) => {
          // If password is set, and passwords don't match, then return an error
          if (form.passwordNew && form.passwordNew !== form[id]) {
            return [[id, 'Passwords do not match']];
          }

          return [];
        },
        getData: getPasswordData,
      },
    ],
  },
];

export default formGroups;
