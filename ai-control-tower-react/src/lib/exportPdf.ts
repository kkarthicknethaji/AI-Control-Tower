/** Renders a DOM node to a compressed, paginated PDF — same html2canvas + jsPDF pattern used by the legacy Cost Tower's actDownloadReport (scripts/cost-tower.js). */
export async function exportNodeToPdf(node: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2 });
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  // JPEG at high quality instead of lossless PNG keeps the export compressed for a UI screenshot.
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  let heightRemaining = imgHeight;
  let pageIndex = 0;
  while (heightRemaining > 0) {
    if (pageIndex > 0) pdf.addPage();
    const yOffset = margin - pageIndex * usableHeight;
    pdf.addImage(imgData, 'JPEG', margin, yOffset, imgWidth, imgHeight);
    heightRemaining -= usableHeight;
    pageIndex++;
  }
  pdf.save(fileName);
}
