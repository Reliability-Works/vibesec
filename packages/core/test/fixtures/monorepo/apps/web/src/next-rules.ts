export const nextRulesFixture = {
  revalidate: 0,
  publicSecret: process.env.NEXT_PUBLIC_API_SECRET,
  publicToken: process.env.NEXT_PUBLIC_SESSION_TOKEN,
}

export const dangerouslySetInnerHtmlFixture =
  "dangerouslySetInnerHTML={{ __html: '<img src=x onerror=alert(1) />' }}"
