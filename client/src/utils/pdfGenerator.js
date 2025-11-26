import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEFAULT_COMPANY = {
  company: 'Fashion Holding Düsseldorf GmbH',
  street: 'An der Becke 34',
  postalCity: '45527 Hattingen',
  country: 'Deutschland',
  phone: 'Tel: +49 234 9772510',
  email: 'Email: service@fhd.agency',
  website: 'www.fhd.agency'
};

class PDFGenerator {
  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
    this.marginLeft = 14;
    this.marginRight = 14;
    this.currentY = 15;
    this.lineHeight = 4.5;
    this.logoLoaded = false;
    this.logoData = null;
  }

  async loadLogo(logoUrl = '/fhd_logo.png') {
    try {
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.logoData = reader.result;
          this.logoLoaded = true;
          resolve();
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load logo:', error);
      this.logoLoaded = false;
    }
  }

  addLogo(width = 50) {
    if (!this.logoLoaded || !this.logoData) {
      return;
    }

    const logoX = (this.pageWidth - width) / 2;
    const logoHeight = width * 0.4;

    this.doc.addImage(this.logoData, 'PNG', logoX, this.currentY, width, logoHeight);
    this.currentY += logoHeight + 8;
  }

  addFullHeader(metadata, recipient, company = DEFAULT_COMPANY) {
    const startY = this.currentY;
    const rightX = this.pageWidth - this.marginRight;

    // LEFT SIDE - Company header
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(company.company, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.text(company.street, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.text(company.postalCity, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.text(company.country, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.text(company.phone, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.text(company.email, this.marginLeft, this.currentY);

    this.currentY += this.lineHeight;
    this.doc.text(company.website, this.marginLeft, this.currentY);

    // RIGHT SIDE - Metadata
    let metaY = startY;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');

    if (metadata.offerNumber) {
      this.doc.text(`Angebotsnummer: ${metadata.offerNumber}`, rightX, metaY, { align: 'right' });
      metaY += this.lineHeight;
    }
    if (metadata.date) {
      this.doc.text(`Datum: ${metadata.date}`, rightX, metaY, { align: 'right' });
      metaY += this.lineHeight;
    }
    if (metadata.validUntil) {
      this.doc.text(`Gültig bis: ${metadata.validUntil}`, rightX, metaY, { align: 'right' });
      metaY += this.lineHeight;
    }

    this.currentY += 10;

    // Recipient below company info
    if (recipient && (recipient.company || recipient.name)) {
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');

      if (recipient.company) {
        this.doc.text(recipient.company, this.marginLeft, this.currentY);
        this.currentY += this.lineHeight;
      }
      if (recipient.name) {
        this.doc.text(recipient.name, this.marginLeft, this.currentY);
        this.currentY += this.lineHeight;
      }
      if (recipient.street) {
        this.doc.text(recipient.street, this.marginLeft, this.currentY);
        this.currentY += this.lineHeight;
      }
      if (recipient.postalCode || recipient.city) {
        const cityLine = `${recipient.postalCode || ''} ${recipient.city || ''}`.trim();
        this.doc.text(cityLine, this.marginLeft, this.currentY);
        this.currentY += this.lineHeight;
      }
      if (recipient.country) {
        this.doc.text(recipient.country, this.marginLeft, this.currentY);
        this.currentY += this.lineHeight;
      }

      this.currentY += 6;
    }
  }

  addDocumentTitle(title) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.marginLeft, this.currentY);
    this.currentY += 10;
  }

  addMessage(message) {
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    const maxWidth = this.pageWidth - this.marginLeft - this.marginRight;
    const lines = this.doc.splitTextToSize(message, maxWidth);

    lines.forEach(line => {
      if (this.currentY + this.lineHeight > this.pageHeight - 40) {
        this.addPageBreak();
      }
      this.doc.text(line, this.marginLeft, this.currentY);
      this.currentY += this.lineHeight + 1;
    });

    this.currentY += 6;
  }

  addSection(section) {
    const estimatedHeight = 10 + section.items.length * 6;
    if (this.currentY + estimatedHeight > this.pageHeight - 40) {
      this.addPageBreak();
    }

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${section.title}:`, this.marginLeft, this.currentY);
    this.currentY += 5;

    const tableData = section.items.map(item => [
      item.description,
      item.value
    ]);

    const highlightRows = section.items
      .map((item, index) => item.highlight ? index : -1)
      .filter(index => index !== -1);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Beschreibung', 'Wert']],
      body: tableData,
      theme: 'striped',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [50, 50, 50],
        lineColor: [180, 180, 180],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right', cellWidth: 60 }
      },
      margin: { left: this.marginLeft, right: this.marginRight },
      didParseCell: (data) => {
        if (data.section === 'body' && highlightRows.includes(data.row.index)) {
          data.cell.styles.fillColor = [255, 243, 205];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [102, 77, 3];
        }
      }
    });

    this.currentY = this.doc.lastAutoTable.finalY + 6;
  }

  addLegalNotes(notes) {
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'italic');

    notes.forEach(note => {
      if (this.currentY + 6 > this.pageHeight - 30) {
        this.addPageBreak();
      }
      this.doc.text(note, this.marginLeft, this.currentY);
      this.currentY += 4;
    });

    this.doc.setFont('helvetica', 'normal');
    this.currentY += 4;
  }

  addSimpleFooter(text) {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      const footerY = this.pageHeight - 5;

      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(text, this.pageWidth / 2, footerY, { align: 'center' });
    }
  }

  addPageBreak() {
    this.doc.addPage();
    this.currentY = 15;
  }

  save(filename) {
    this.doc.save(filename);
  }

  getBase64() {
    const dataUrl = this.doc.output('dataurlstring');
    return dataUrl.split(',')[1];
  }

  getDoc() {
    return this.doc;
  }
}

export default PDFGenerator;
