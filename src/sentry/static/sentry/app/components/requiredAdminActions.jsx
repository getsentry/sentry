import SetCallsignsAction from '../views/requiredAdminActions/setCallsigns';

const requiredAdminActions = {
  SET_CALLSIGNS: SetCallsignsAction
};

for (let key in requiredAdminActions) {
  requiredAdminActions[key].ID = key;
}

export default requiredAdminActions;
