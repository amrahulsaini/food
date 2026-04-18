export const RESTRO_GATE_COOKIE_NAME = "restro_gate_access";

export function getRestroGatePassword(): string {
  return process.env.RESTRO_GATE_PASSWORD?.trim() ?? "";
}

export function isRestroGateEnabled(): boolean {
  return getRestroGatePassword().length > 0;
}

export function isRestroGateAuthorized(cookieValue: string | undefined): boolean {
  if (!isRestroGateEnabled()) {
    return true;
  }

  if (!cookieValue) {
    return false;
  }

  return cookieValue === getRestroGatePassword();
}
