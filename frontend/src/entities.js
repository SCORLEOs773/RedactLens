const TYPES = {
  PERSON: { label: "Names", tint: "var(--m-name)" },
  LOCATION: { label: "Places", tint: "var(--m-place)" },
  IE_EIRCODE: { label: "Places", tint: "var(--m-place)" },
  EMAIL_ADDRESS: { label: "Emails", tint: "var(--m-contact)" },
  PHONE_NUMBER: { label: "Phone numbers", tint: "var(--m-contact)" },
  IE_PHONE: { label: "Phone numbers", tint: "var(--m-contact)" },
  IE_PPSN: { label: "PPS numbers", tint: "var(--m-id)" },
};

export const typeInfo = (type) =>
  TYPES[type] || { label: "Other", tint: "var(--m-name)" };
