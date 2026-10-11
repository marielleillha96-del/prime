(() => {
  const phone = "5511957342158";
  const siteUrl = "https://www.primeveiculosemaquinas.com.br";

  window.vehicleWhatsAppUrl = (item) => {
    const price = Number(item.price || 0) > 0
      ? Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "Sob consulta";
    const vehicleUrl = `${siteUrl}/detalhe?slug=${encodeURIComponent(item.slug)}`;
    const message = [
      "Olá, tenho interesse neste veículo da PRIME LEILÕES:",
      "",
      `Título: ${item.title}`,
      `Preço: ${price}`,
      `Descrição: ${String(item.description || "Descrição não informada").trim()}`,
      "",
      `Link do veículo: ${vehicleUrl}`
    ].join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };
})();
