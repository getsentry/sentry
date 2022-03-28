import Form from 'sentry/components/forms/form';
import Hook from 'sentry/components/hook';
import ThemeAndStyleProvider from 'sentry/components/themeAndStyleProvider';

const SuperuserAccessForm: React.FC<any> = _props => {
  return (
    <ThemeAndStyleProvider>
      <Form>
        <Hook name="component:superuser-access-category" />
      </Form>
    </ThemeAndStyleProvider>
  );
};

export default SuperuserAccessForm;
