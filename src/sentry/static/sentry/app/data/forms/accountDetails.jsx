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

// For fields that are
const getUserIsManaged = ({user}) => user.isManaged;
const getUserIsNotManaged = ({user}) => !user.isManaged;

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Account Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        placeholder: 'e.g. John Doe',
        help: 'Your full name',
      },
      {
        name: 'username',
        type: 'string',
        required: true,

        autoComplete: 'username',
        label: 'Username',
        placeholder: 'e.g. name@example.com',
        help: '',
        disabled: getUserIsManaged,
        visible: ({user}) => user.email !== user.username,
      },
      {
        name: 'password',
        type: 'secret',

        autoComplete: 'new-password',
        label: 'New Password',
        placeholder: '',
        help: '',
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
        help: '',
        visible: getUserIsNotManaged,
        validate: ({id, form}) => {
          // If password is set, and passwords don't match, then return an error
          if (form.password && form.password !== form[id]) {
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
